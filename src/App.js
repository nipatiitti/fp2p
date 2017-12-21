import React, { Component } from 'react';
import config from './config/config.json';
import './App.css';

import TextField from 'material-ui/TextField';
import LinearProgress from 'material-ui/LinearProgress';
import Avatar from 'material-ui/Avatar';
import RaisedButton from 'material-ui/RaisedButton';
import Dialog from 'material-ui/Dialog';
import CircularProgress from 'material-ui/CircularProgress';
import Chip from 'material-ui/Chip';
import FontIcon from 'material-ui/FontIcon';
import Snackbar from 'material-ui/Snackbar';
import {blue500, greenA200, pink400, red600} from 'material-ui/styles/colors';

var randomstring = require('randomstring');
var Peer = require('peerjs');

class App extends Component {

  constructor(props) {
	   super(props);

     this.state = {
       peer: null,
       id: '',
       connected: 'false',

       connections: {},
       toConnect: '',

       snack: {
         open: false,
         text: ''
       },
       dialog: {
         open: false,
         text: ''
       },
       bars: {},
     }

  }

  componentDidMount() {

  }

  componentWillUnmount(){
    if(this.state.peer != null)
  	  this.state.peer.destroy();
  }

  listenForActions() {
    if (this.state.peer != null) {
      this.state.peer.on('error', (err) => {
          this.setState({
            dialog: {
              open: true,
              text: 'Error: ' + err.type
            }
          })
        if (err.type !== 'peer-unavailable')
          this.disconnect();
      });

      this.state.peer.on('open', (id) => {
        this.setState({
          id,
          connected: 'true'
        })
      });

      this.state.peer.on('connection', (dataConnection) => {
        console.log(dataConnection);
        dataConnection.on('open', () => {
          console.log('opening', dataConnection);
          let connections = this.state.connections;
          let key = randomstring.generate(16);

          let connection = {
            _key: key,
            closed: false,
            connection: dataConnection,
            label: dataConnection.peer,
            files: []
          };

          dataConnection.on('data', (data) => this.addIncoming(data, key));
          dataConnection.on('error', (err) => {
            this.setState({
              dialog:{
                open: true,
                text: err.message
              }
            });
          });

          dataConnection.on('close', () => {
            let c = this.state.connections;
            c[key].closed = true;
            this.setState({
              connections: c
            })
          });

          dataConnection.on('chunks', (data) => {
            let bars = this.state.bars;

            let amount = Math.round((data.count / data.total) * 100);

            bars[key] = amount;

            this.setState({bars});
          });

          connections[key] = connection;

          this.setState({
            connections
          });
        })
      });
    }
  }

  disconnect() {
    if (this.state.peer != null)
      this.state.peer.destroy();
      this.setState({
        peer: null,
        connected: 'false',
        id: '',
        toConnect: '',
        connection_loading: false,
        connections: {},
        bars: {}
      })
  }

  sendFile(event, key) {
    let file = event.target.files[0];
    let blob = new Blob(event.target.files, {type: file.type});

    this.state.connections[key].connection.send({
        file: blob,
        size: blob.size,
        filename: file.name,
        filetype: file.type
    });
  }

  addIncoming(data, key) {
    console.log(data);
    let file_name = data.filename;
    let file_url = URL.createObjectURL(new Blob([data.file], {type: data.filetype}));

    let connections = this.state.connections;

    connections[key].files.push({
      id: randomstring.generate(8),
      size: this.humanFileSize(data.size, true),
      type: data.filetype,
      url: file_url,
      name: file_name
    });

    this.setState({
      connections
    });

  }

  listenForIncoming(dataConnection) {

  }

  handleRequestDelete(key) {
    let connections = this.state.connections;
    let bars = this.state.bars;

    connections[key].connection.close();

    delete connections[key];
    delete bars[key];

    this.setState({connections, bars});
  };

	connect() {
    if(this.state.id === "") {
      this.setState({
        dialog: {
          open: true,
          text: "ID is empty"
        }
      })
      return;
    }

    this.setState({
      connected: 'loading',
      peer: new Peer(this.state.id, {
        host: 'server.fp2p.tk',
        path: 'app',
        port: 443,
        secure: true
      })
    }, () => this.listenForActions());
  }

  connectTo() {
    let connections = this.state.connections;

    let key = randomstring.generate(16);

    let connection = {
      _key: key,
      canSend: false,
      connection: this.state.peer.connect(this.state.toConnect, {reliable: true}),
      label: this.state.toConnect,
      files: []
    };

    connection.connection.on('data', (data) => this.addIncoming(data, key));
    connection.connection.on('error', (err) => {
      this.setState({
        dialog:{
          open: true,
          text: err.message
        }
      });
    });
    connection.connection.on('open', () => {
      let c = this.state.connections;
      c[key].canSend = true;
      this.setState({
        connections
      })
    });

    connection.connection.on('chunks', (data) => {
      let bars = this.state.bars;

      let amount = Math.round((data.count / data.total) * 100);

      bars[key] = amount;

      this.setState({bars});
    });

    connection.connection.on('close', () => {
      let c = this.state.connections;
      c[key].closed = true;
      this.setState({
        connections: c
      })
    });

    connections[key] = connection;

    this.setState({
      connections
    });

  }

  closeSnack() {
    this.setState({
      snack: {
        open: false,
        text: ''
      }
    })
  }

  humanFileSize(bytes, si) {
    let thresh = si ? 1000 : 1024;
    if(Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    let units = si
        ? ['kB','MB','GB','TB','PB','EB','ZB','YB']
        : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
    let u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1)+' '+units[u];
}

  closeDialog() {
    this.setState({
      dialog: {
        open: false,
        text: ''
      }
    })
  }

  render() {
    const peer = this.state.connected === 'false' ?
      <div id="peer">
        <TextField
          floatingLabelText="Choose id"
          value={this.state.id}
          onChange={(event, newValue) => {
            this.setState({
              id: newValue
            });
          }}
          onKeyPress={(event) => {
            if (event.key === 'Enter') {
              this.connect();
            }
          }}
        />
        <RaisedButton label="Connect" secondary={true} onClick={() => this.connect()} />
      </div>

    : this.state.connected === 'loading' ? <div id="peer"><CircularProgress size={80} thickness={5} /></div> :
      <div id="peer">
        <TextField floatingLabelText=" Your ID" value={this.state.id} />

        <TextField
          floatingLabelText="Connect to:"
          value={this.state.toConnect}
          onChange={(event, newValue) => {
            this.setState({
              toConnect: newValue
            });
          }}
          onKeyPress={(event) => {
            if (event.key === 'Enter') {
              this.connectTo();
            }
          }}
        />

        <RaisedButton
          label="Connect"
          secondary={true}
          onClick={() => this.connectTo()}
        />

        <div className="loadingBars">
          {Object.keys(this.state.bars).map((key) => {

            let amount = this.state.bars[key];

            return(
              <div className="bar" key={key}>
                <span className="white">{this.state.connections[key].label + ', ' + amount + '%'}</span>
                <LinearProgress mode="determinate" value={amount} />
              </div>
            )
          })}
        </div>

      </div>
    ;

    const dialog =
      <Dialog
        actions={[
          <RaisedButton
            label="Close"
            primary={true}
            onClick={() => this.closeDialog()}
          />
        ]}
        modal={false}
        open={this.state.dialog.open}
        onRequestClose={() => this.closeDialog()}
      >
        {this.state.dialog.text}
      </Dialog>
    ;

    const snack =
      <Snackbar
        open={this.state.snack.open}
        message={this.state.snack.text}
        autoHideDuration={4000}
        onRequestClose={() => this.closeSnack()}
      />
    ;

    const connections = this.state.connections !== {} ?
      <div id="files">
      {
        Object.keys(this.state.connections).map((key) => {

          if(this.state.connections[key].connection.open === false && this.state.connections[key].closed === false) {
            return (
              <Chip
                className="chips"
                onRequestDelete={() => this.handleRequestDelete(key)}
                key={key}
                style={{margin: '10px', minHeight: '30px'}}
              >
                <Avatar icon={
                  <CircularProgress size={20} thickness={3} />
                } />

                <span>{this.state.connections[key].label}</span>
              </Chip>
            )
          }

          const avatarIcon = this.state.connections[key].closed ?
            <label htmlFor={key} className="addFileContainer">
              <FontIcon className="material-icons" color={red600}>error_outline</FontIcon>
            </label>
          :
            <label htmlFor={key} className="addFileContainer">
              <FontIcon className="material-icons" color={blue500} hoverColor={greenA200}>file_upload</FontIcon>
              <input className="fileInput" type="file" id={key} onChange={(event) => this.sendFile(event, key)} />
            </label>
          ;

          return(
            <Chip
              className="chips"
              onRequestDelete={() => this.handleRequestDelete(key)}
              key={key}
              style={{margin: '10px', minHeight: '30px'}}
            >
              <Avatar icon={avatarIcon} />

              <span>{this.state.connections[key].label}</span>

              {
                this.state.connections[key].files.map((file) => {
                  let id = randomstring.generate(8);
                  return (
                    <div key={id} className="addFileContainer">
                      <a id={id} href={file.url} download={file.name}>
                        <FontIcon className="material-icons link" color={greenA200} hoverColor={pink400} >
                          file_download
                        </FontIcon>
                        <span className="white" >{file.size + ", " + file.type}</span>
                      </a>
                    </div>
                  )
                })
              }
            </Chip>
          )
        })
      }
      </div>
    :
      <div id="files">

      </div>
    ;

    return (
      <div className="App">
        {snack}
        {dialog}
        {peer}
        {connections}
      </div>
    );
  }

}

export default App;
