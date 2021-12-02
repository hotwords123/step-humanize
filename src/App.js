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
      lines: []
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
   * @param {string} content 
   */
  loadFile(content) {
    try {
      const lines = content.split(/\r?\n/);
      this.idMap.clear();
      const parsedLines = lines.map((line, lineNo) => {
        const data = this.parseLine(line);
        if (data.id) this.idMap.set(data.id, lineNo);
        return data;
      });
      this.lineChildren = new Array(parsedLines.length)
        .fill(null)
        .map(() => React.createRef());
      this.setState({ loaded: true, lines: parsedLines });
    } catch (err) {
      this.setState({ loaded: false, lines: [] });
      console.error(err);
    }
  }

  render() {
    return (
      <div className="App">
        <div>
          <input ref={this.fileInput} type="file" onChange={this.fileSelectHandler} />
        </div>
        {this.state.loaded &&
          <div>
            {this.state.lines.map((line, lineNo) =>
              <FileLine key={lineNo} ref={this.lineChildren[lineNo]} line={line} onNavigate={this.navigateHandler} />
            )}
          </div>
        }
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
