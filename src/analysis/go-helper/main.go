// The helper analyzes JSON snapshots only. Never use go/importer or go/packages:
// both can load files or dependencies outside the captured repository.
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/build"
	"go/parser"
	"go/token"
	"go/types"
	"io"
	"os"
	"path"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"text/scanner"
)

type input struct {
	Files map[string]string `json:"files"`
	OS    string            `json:"os"`
	Arch  string            `json:"arch"`
	Tags  []string          `json:"tags"`
}
type node struct {
	Path string `json:"path"`
}
type edge struct {
	Source string `json:"source"`
	Target string `json:"target"`
}
type reference struct {
	Source     string `json:"source"`
	Kind       string `json:"kind"`
	Line       int    `json:"line"`
	Column     int    `json:"column"`
	Expression string `json:"expression"`
	Specifier  string `json:"specifier,omitempty"`
	Outcome    string `json:"outcome"`
	Target     string `json:"target,omitempty"`
	Reason     string `json:"reason,omitempty"`
}
type diagnostic struct {
	Path    string `json:"path"`
	Message string `json:"message"`
}
type configuration struct {
	OS      string   `json:"os"`
	Arch    string   `json:"arch"`
	Tags    []string `json:"tags"`
	Version string   `json:"version"`
	Cgo     bool     `json:"cgo"`
}
type graph struct {
	Nodes       []node        `json:"nodes"`
	Edges       []edge        `json:"edges"`
	References  []reference   `json:"references"`
	Diagnostics []diagnostic  `json:"diagnostics"`
	Go          configuration `json:"go"`
}
type group struct {
	production []*ast.File
	tests      []*ast.File
	external   []*ast.File
	name       string
}
type analyzer struct {
	input       input
	graph       graph
	fset        *token.FileSet
	groups      map[string]*group
	module      string
	version     string
	edges       map[edge]bool
	refs        map[reference]bool
	diagnostics map[diagnostic]bool
}

func (a *analyzer) diagnostic(file, message string) {
	d := diagnostic{file, message}
	if !a.diagnostics[d] {
		a.graph.Diagnostics = append(a.graph.Diagnostics, d)
		a.diagnostics[d] = true
	}
}

// Strip comments using Go's lexer, keeping quoted module paths intact.
func moduleSettings(source string) (string, string, error) {
	var s scanner.Scanner
	s.Init(strings.NewReader(source))
	s.Mode = scanner.ScanStrings | scanner.ScanRawStrings | scanner.ScanComments
	clean := []byte(source)
	var scanErr error
	s.Error = func(_ *scanner.Scanner, msg string) { scanErr = fmt.Errorf("invalid go.mod: %s", msg) }
	for tok := s.Scan(); tok != scanner.EOF; tok = s.Scan() {
		if tok == scanner.Comment {
			for i := s.Position.Offset; i < s.Position.Offset+len(s.TokenText()); i++ {
				if clean[i] != '\n' {
					clean[i] = ' '
				}
			}
		}
	}
	if scanErr != nil {
		return "", "", scanErr
	}
	modulePattern := regexp.MustCompile(`^module\s+("(?:\\.|[^"\\])*"|[^\s"]+)\s*$`)
	versionPattern := regexp.MustCompile(`^go\s+(\d+\.\d+(?:\.\d+)?)\s*$`)
	var module, version string
	depth := 0
	for _, line := range strings.Split(string(clean), "\n") {
		line = strings.TrimSpace(line)
		if depth == 0 {
			if match := modulePattern.FindStringSubmatch(line); match != nil {
				if module != "" {
					return "", "", fmt.Errorf("go.mod has multiple module directives")
				}
				module = match[1]
				if strings.HasPrefix(module, `"`) {
					module, scanErr = strconv.Unquote(module)
				}
			} else if match := versionPattern.FindStringSubmatch(line); match != nil {
				if version != "" {
					return "", "", fmt.Errorf("go.mod has multiple go directives")
				}
				version = "go" + match[1]
			} else if fields := strings.Fields(line); len(fields) > 0 && (fields[0] == "go" || fields[0] == "module") {
				return "", "", fmt.Errorf("invalid go.mod directive: %s", line)
			}
		}
		if strings.HasSuffix(line, "(") {
			depth++
		}
		if line == ")" {
			depth--
		}
		if depth < 0 {
			return "", "", fmt.Errorf("unbalanced go.mod directive block")
		}
	}
	if depth != 0 {
		return "", "", fmt.Errorf("unbalanced go.mod directive block")
	}
	if scanErr != nil || module == "" || strings.ContainsAny(module, " \\\t\n\r") || path.Clean(module) != module || strings.HasPrefix(module, "/") || strings.HasPrefix(module, ".") {
		return "", "", fmt.Errorf("go.mod must contain one valid module directive")
	}
	// Match cmd/go's default for modules without a go directive.
	if version == "" {
		version = "go1.16"
	}
	return module, version, nil
}

func (a *analyzer) ref(pos token.Pos, expression, kind, outcome, target, specifier, reason string) {
	p := a.fset.PositionFor(pos, false)
	// token columns are UTF-8 bytes; the UI uses JavaScript (UTF-16) columns.
	column := p.Column
	if content, ok := a.input.Files[p.Filename]; ok && p.Offset <= len(content) {
		start := strings.LastIndex(content[:p.Offset], "\n") + 1
		column = 1
		for _, r := range content[start:p.Offset] {
			column++
			if r > 0xffff {
				column++
			}
		}
	}
	r := reference{p.Filename, kind, p.Line, column, expression, specifier, outcome, target, reason}
	if !a.refs[r] {
		a.graph.References = append(a.graph.References, r)
		a.refs[r] = true
	}
	if target != "" && p.Filename != target {
		a.edges[edge{p.Filename, target}] = true
	}
}

type importer struct {
	a        *analyzer
	cache    map[string]*types.Package
	loading  map[string]bool
	override string
}

func (l *importer) Import(name string) (*types.Package, error) {
	if name == "unsafe" {
		return types.Unsafe, nil
	}
	if p := l.cache[name]; p != nil {
		return p, nil
	}
	if l.loading[name] {
		return nil, fmt.Errorf("import cycle involving %s", name)
	}
	g := l.a.groups[name]
	if g == nil || (len(g.production) == 0 && (name != l.override || len(g.tests) == 0)) {
		return nil, fmt.Errorf("%s is unavailable in the captured module; external and installed packages are not read", name)
	}
	files := g.production
	if name == l.override {
		files = append(append([]*ast.File{}, files...), g.tests...)
	}
	l.loading[name] = true
	p := l.check(name, files)
	delete(l.loading, name)
	if p == nil {
		return nil, fmt.Errorf("could not analyze %s", name)
	}
	l.cache[name] = p
	return p, nil
}

func (l *importer) check(name string, files []*ast.File) *types.Package {
	a := l.a
	info := &types.Info{Uses: map[*ast.Ident]types.Object{}, Selections: map[*ast.SelectorExpr]*types.Selection{}}
	conf := types.Config{Importer: l, GoVersion: a.version, Sizes: types.SizesFor("gc", a.graph.Go.Arch), Error: func(err error) {
		if typed, ok := err.(types.Error); ok {
			a.diagnostic(a.fset.PositionFor(typed.Pos, false).Filename, typed.Msg)
		} else {
			a.diagnostic(name, err.Error())
		}
	}}
	pkg, _ := conf.Check(name, a.fset, files, info)
	for ident, object := range info.Uses {
		if _, isPackage := object.(*types.PkgName); isPackage {
			continue
		}
		target := a.fset.PositionFor(object.Pos(), false).Filename
		source := a.fset.PositionFor(ident.Pos(), false).Filename
		if _, captured := a.input.Files[target]; captured && target != source {
			a.ref(ident.Pos(), ident.Name, "symbol", "resolved", target, "", "")
		}
	}
	for expr, selection := range info.Selections {
		target := a.fset.PositionFor(selection.Obj().Pos(), false).Filename
		if _, captured := a.input.Files[target]; captured && target != a.fset.PositionFor(expr.Pos(), false).Filename {
			a.ref(expr.Sel.Pos(), expr.Sel.Name, "symbol", "resolved", target, "", "")
		}
	}
	for _, file := range files {
		for _, imp := range file.Imports {
			name, err := strconv.Unquote(imp.Path.Value)
			if err != nil {
				continue
			}
			outcome, reason := "resolved", ""
			if name == "unsafe" {
				outcome, reason = "excluded", "Built-in unsafe package has no captured source."
			} else if _, err := l.Import(name); err != nil {
				outcome, reason = "unresolved", err.Error()
			} else if imp.Name != nil && imp.Name.Name == "_" {
				outcome, reason = "unresolved", "Side-effect imports have no referenced declaration; package initialization dependencies are not represented."
			}
			a.ref(imp.Path.Pos(), imp.Path.Value, "import", outcome, "", name, reason)
		}
	}
	return pkg
}

func analyze(in input) graph {
	if in.OS == "" {
		in.OS = runtime.GOOS
	}
	if in.Arch == "" {
		in.Arch = runtime.GOARCH
	}
	if in.Tags == nil {
		in.Tags = []string{}
	}
	sort.Strings(in.Tags)
	a := &analyzer{input: in, fset: token.NewFileSet(), groups: map[string]*group{}, edges: map[edge]bool{}, refs: map[reference]bool{}, diagnostics: map[diagnostic]bool{}}
	a.graph = graph{[]node{}, []edge{}, []reference{}, []diagnostic{}, configuration{in.OS, in.Arch, in.Tags, runtime.Version(), false}}
	paths, modules, workspaces := []string{}, []string{}, []string{}
	for name := range in.Files {
		if strings.HasSuffix(name, ".go") {
			paths = append(paths, name)
		}
		if path.Base(name) == "go.mod" {
			modules = append(modules, name)
		}
		if path.Base(name) == "go.work" {
			workspaces = append(workspaces, name)
		}
	}
	sort.Strings(paths)
	if len(modules) != 1 || len(workspaces) != 0 {
		for _, name := range paths {
			a.diagnostic(name, "Go analysis requires exactly one captured go.mod and no go.work; multi-module workspaces are unsupported.")
		}
		return a.graph
	}
	var err error
	a.module, a.version, err = moduleSettings(in.Files[modules[0]])
	if err != nil {
		a.diagnostic(modules[0], err.Error())
		return a.graph
	}
	if types.SizesFor("gc", in.Arch) == nil {
		a.diagnostic(modules[0], "Unsupported Go architecture: "+in.Arch)
		return a.graph
	}
	knownOS := " aix android darwin dragonfly freebsd hurd illumos ios js linux netbsd openbsd plan9 solaris wasip1 windows zos "
	if !strings.Contains(knownOS, " "+in.OS+" ") {
		a.diagnostic(modules[0], "Unsupported Go OS: "+in.OS)
		return a.graph
	}
	ctx := build.Default
	ctx.GOOS, ctx.GOARCH, ctx.CgoEnabled, ctx.BuildTags = in.OS, in.Arch, false, in.Tags
	// Baseline architecture features, independent of the helper's host architecture.
	ctx.ToolTags = []string{}
	features := map[string][]string{"amd64": {"amd64.v1"}, "arm": {"arm.5", "arm.6", "arm.7"}, "arm64": {"arm64.v8.0"}, "386": {"386.sse2"}, "ppc64": {"ppc64.power8"}, "ppc64le": {"ppc64le.power8"}, "riscv64": {"riscv64.rva20u64"}, "mips": {"mips.hardfloat"}, "mipsle": {"mipsle.hardfloat"}, "mips64": {"mips64.hardfloat"}, "mips64le": {"mips64le.hardfloat"}}
	ctx.ToolTags = append(ctx.ToolTags, features[in.Arch]...)
	ctx.JoinPath = path.Join
	ctx.OpenFile = func(name string) (io.ReadCloser, error) {
		content, ok := in.Files[name]
		if !ok {
			return nil, os.ErrNotExist
		}
		return io.NopCloser(strings.NewReader(content)), nil
	}
	root := path.Dir(modules[0])
	for _, name := range paths {
		if root != "." && !strings.HasPrefix(name, root+"/") {
			a.diagnostic(name, "File is outside the captured Go module.")
			continue
		}
		if path.Clean(name) != name || strings.Contains(name, "\\") || strings.HasPrefix(name, "/") {
			a.diagnostic(name, "Unsupported snapshot path.")
			continue
		}
		matches, err := ctx.MatchFile(path.Dir(name), path.Base(name))
		if err != nil {
			a.diagnostic(name, err.Error())
			continue
		}
		if !matches {
			a.graph.References = append(a.graph.References, reference{Source: name, Kind: "build-constraint", Line: 1, Column: 1, Expression: name, Outcome: "excluded", Reason: "Excluded by the selected Go build configuration (cgo disabled)."})
			continue
		}
		file, err := parser.ParseFile(a.fset, name, in.Files[name], parser.AllErrors|parser.ParseComments)
		if err != nil {
			a.diagnostic(name, err.Error())
		}
		if file == nil || file.Name == nil || file.Name.Name == "" {
			continue
		}
		cgo := false
		for _, imp := range file.Imports {
			if name, _ := strconv.Unquote(imp.Path.Value); name == "C" {
				cgo = true
			}
		}
		if cgo {
			a.graph.References = append(a.graph.References, reference{Source: name, Kind: "build-constraint", Line: 1, Column: 1, Expression: name, Outcome: "excluded", Reason: "Cgo files are excluded; cgo is disabled for snapshot analysis."})
			continue
		}
		a.graph.Nodes = append(a.graph.Nodes, node{name})
		dir := path.Dir(name)
		rel := dir
		if root != "." {
			rel = strings.TrimPrefix(dir, root)
			rel = strings.TrimPrefix(rel, "/")
		}
		pkgPath := a.module
		if rel != "." && rel != "" {
			pkgPath += "/" + rel
		}
		g := a.groups[pkgPath]
		if g == nil {
			g = &group{}
			a.groups[pkgPath] = g
		}
		isTest := strings.HasSuffix(name, "_test.go")
		if isTest {
			g.tests = append(g.tests, file)
		} else {
			if g.name == "" {
				g.name = file.Name.Name
			}
			g.production = append(g.production, file)
		}
	}
	names := []string{}
	for name := range a.groups {
		names = append(names, name)
		g := a.groups[name]
		if g.name == "" {
			for _, file := range g.tests {
				if !strings.HasSuffix(file.Name.Name, "_test") {
					g.name = file.Name.Name
					break
				}
			}
			if g.name == "" && len(g.tests) > 0 {
				g.name = strings.TrimSuffix(g.tests[0].Name.Name, "_test")
			}
		}
		tests := g.tests
		g.tests = nil
		for _, file := range tests {
			if file.Name.Name != g.name && strings.HasSuffix(file.Name.Name, "_test") {
				g.external = append(g.external, file)
			} else {
				g.tests = append(g.tests, file)
			}
		}
	}
	sort.Strings(names)
	newImporter := func() *importer {
		return &importer{a: a, cache: map[string]*types.Package{}, loading: map[string]bool{}}
	}
	base := newImporter()
	for _, name := range names {
		g := a.groups[name]
		if len(g.production) > 0 {
			base.Import(name)
		}
		if len(g.tests) > 0 {
			l := newImporter()
			l.override = name
			l.Import(name)
		}
		if len(g.external) > 0 {
			for _, file := range g.external {
				if g.name != "" && file.Name.Name != g.name+"_test" {
					a.diagnostic(a.fset.PositionFor(file.Pos(), false).Filename, "External test package name does not match the package under test.")
				}
			}
			l := newImporter()
			l.override = name
			l.check(name+"_test", g.external)
		}
	}
	for e := range a.edges {
		a.graph.Edges = append(a.graph.Edges, e)
	}
	sort.Slice(a.graph.Edges, func(i, j int) bool {
		x, y := a.graph.Edges[i], a.graph.Edges[j]
		if x.Source != y.Source {
			return x.Source < y.Source
		}
		return x.Target < y.Target
	})
	sort.Slice(a.graph.References, func(i, j int) bool {
		x, y := a.graph.References[i], a.graph.References[j]
		if x.Source != y.Source {
			return x.Source < y.Source
		}
		if x.Line != y.Line {
			return x.Line < y.Line
		}
		if x.Column != y.Column {
			return x.Column < y.Column
		}
		return x.Target < y.Target
	})
	sort.Slice(a.graph.Diagnostics, func(i, j int) bool {
		x, y := a.graph.Diagnostics[i], a.graph.Diagnostics[j]
		if x.Path != y.Path {
			return x.Path < y.Path
		}
		return x.Message < y.Message
	})
	return a.graph
}

func main() {
	var in input
	if err := json.NewDecoder(os.Stdin).Decode(&in); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := json.NewEncoder(os.Stdout).Encode(analyze(in)); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
