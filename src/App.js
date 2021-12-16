import React from 'react';
import './App.css';

const TOKEN_TYPES = [
  ['keyword', /^[A-Z_][A-Z0-9_]*$/],
  ['number', /^[+-]?\d+(\.\d*)?(?:[eE][+-]?\d+)?$/],
  ['string', /^'.*'$/],
  ['flag', /^\.[A-Z_]+\.$/],
  ['reference', /^#\d+$/],
  ['sign', /^[*$]$/],
  ['separator', /^[=(),;]$/],
  ['unknown', /^.*$/]
];

class App extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      loaded: false,
      lines: [],
      tree: null,
      treeView: false
    };
    this.idMap = new Map();
    this.fileInput = React.createRef();
    this.lineChildren = [];

    this.fileSelectHandler = this.fileSelectHandler.bind(this);
    this.navigateHandler = this.navigateHandler.bind(this);
  }

  fileSelectHandler() {
    /** @type {HTMLInputElement} */
    const input = this.fileInput.current;
    if (input.files.length === 1) {
      const [file] = input.files;
      const reader = new FileReader();
      reader.onload = () => {
        this.loadFile(reader.result);
      };
      reader.readAsText(file);
    }
  }

  navigateHandler(id) {
    const lineNo = this.idMap.get(id);
    if (typeof lineNo === 'number') {
      /** @type {FileLine} */
      const child = this.lineChildren[lineNo].current;
      child.navigateTo();
    }
  }

  /**
   * @param {string} line 
   */
  parseLine(line) {
    const tokens = line.split(/([=(),]|;$)/) // may accidentally match in string
      .map(token => ({
        token,
        type: TOKEN_TYPES.find(([, pattern]) => pattern.test(token))[0]
      }));
    const temp = line.match(/^#(\d+)=/);
    const id = temp ? parseInt(temp[1]) : null;
    return { text: line, id, tokens };
  }

  /**
   * @typedef {{
   *   type: string;
   *   token: string;
   * }} TokenData
   * @typedef {{
   *   index: number;
   *   id: number | null;
   *   text: string;
   *   tokens: TokenData[];
   * }} LineData
   * @typedef {{
   *   line: LineData;
   *   children: TreeData[];
   * }} TreeData
   */

  /**
   * @param {string} content 
   */
  loadFile(content) {
    try {
      const lines = content.split(/\r?\n/);
      this.idMap.clear();

      /** @type {LineData[]} */
      const parsedLines = lines.map((line, lineNo) => {
        const data = this.parseLine(line);
        if (data.id) this.idMap.set(data.id, lineNo);
        return { index: lineNo, ...data };
      });

      this.lineChildren = new Array(parsedLines.length)
        .fill(null)
        .map(() => React.createRef());

      /** @type {TreeData} */
      let root = {
        line: {
          id: null,
          text: '#root',
          tokens: [{ type: 'sign', token: '#root' }]
        },
        children: []
      };

      try {
        /** @type {TreeData[]} */
        const nodes = parsedLines.map(line => ({ line, children: [] }));
        const referenced = new Set();

        parsedLines.forEach((line, lineNo) => {
          let selfId = line.id;
          if (selfId === null) return;

          for (let token of line.tokens) {
            if (token.type === 'reference') {
              let refId = parseInt(token.token.slice(1));
              if (refId !== selfId) {
                nodes[lineNo].children.push(nodes[this.idMap.get(refId)]);
                referenced.add(refId);
              }
            }
          }
        });

        // TODO: check circular reference
        for (const node of nodes) {
          if (node.line.id && !referenced.has(node.line.id))
            root.children.push(node);
        }
      } catch (err) {
        console.warn("Failed to build tree:", err);
      }

      this.setState({ loaded: true, lines: parsedLines, tree: root });
    } catch (err) {
      this.setState({ loaded: false, lines: [], tree: null });
      console.error(err);
    }
  }

  renderLinearView() {
    return (
      <div>
        {this.state.lines.map((line, lineNo) =>
          <FileLine key={lineNo} ref={this.lineChildren[lineNo]} line={line} onNavigate={this.navigateHandler} />
        )}
      </div>
    );
  }

  renderTreeView() {
    const root = this.state.tree;
    if (!root)
      return <div>Failed to build tree.</div>;
    return <TreeNode owner={this} node={root} depth={0} />;
  }

  render() {
    return (
      <div className="App">
        <div>
          <input ref={this.fileInput} type="file" onChange={this.fileSelectHandler} />
          <button onClick={() => this.setState({ treeView: !this.state.treeView })}>
            {this.state.treeView ? "Tree" : "Linear"}
          </button>
        </div>
        {this.state.loaded && (this.state.treeView ? this.renderTreeView() : this.renderLinearView())}
      </div>
    );
  }
}

class TreeNode extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      collapsed: false
    };

    this.toggleHandler = this.toggleHandler.bind(this);
  }

  toggleHandler() {
    this.setState({ collapsed: !this.state.collapsed });
  }

  render() {
    /** @type {App} */
    const owner = this.props.owner;
    /** @type {TreeData} */
    const node = this.props.node;
    const depth = this.props.depth;
    return (
      <div className="TreeNode">
        <div className="TreeNode-line">
          <div style={{ fontFamily: "Consolas", float: "left" }} onClick={this.toggleHandler}>{this.state.collapsed ? '+' : '-'}</div>
          <FileLine ref={owner.lineChildren[node.line.index]} line={node.line} onNavigate={owner.navigateHandler} />
        </div>
        <div className={`TreeNode-children depth-${depth % 7} ${this.state.collapsed ? 'collapsed' : ''}`}>
          {node.children.map(child =>
            <TreeNode key={child.line.index} owner={owner} node={child} depth={depth + 1} />
          )}
        </div>
      </div>
    );
  }
}

class FileLine extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      active: false
    };
    this.container = React.createRef();

    this.clickHandler = this.clickHandler.bind(this);
  }

  navigateTo() {
    this.container.current.scrollIntoView({
      block: 'center'
    });
    this.setState({ active: true });
    setTimeout(() => this.setState({ active: false }), 1500);
  }

  clickHandler(token) {
    this.props.onNavigate(parseInt(token.match(/^#(\d+)$/)[1]));
  }

  render() {
    return (
      <div className={`line${this.state.active ? ' active' : ''}`} ref={this.container}>
        <code>
          {this.props.line.tokens.map(({ token, type }, index) => {
            return (
              <span
                key={index}
                className={`token-${type}`}
                onClick={type === 'reference' ? (() => this.clickHandler(token)) : null}
              >
                {token}
              </span>
            );
          })}
        </code>
      </div>
    );
  }
}

export default App;
