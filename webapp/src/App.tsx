import React from 'react';
import './App.css';
import { AppState, WSData } from './model';
import { SprinklerLi } from './SprinklerLi';
import { GardenMap } from './GradenMap';
import { BFF_ADDRESS } from './config';

class App extends React.Component {
  #ws!: WebSocket;

  state: AppState = {
    garden: null
  }
  constructor(props: any) {
    super(props);

  }
  render() {
    const raining = this.state.garden?.raining;
    const states = Object.entries(this.state.garden?.status ?? {});
    const configs = this.state.garden?.config ?? {};
    return (
      <div className="App">
        <div className="Sprinklers">
          {states.map(([key, state]) => (<SprinklerLi key={key} state={state} config={configs[key]} />))}
        </div>
        <div className="Map">
          <GardenMap width={400} height={400} garden={this.state.garden} />
        </div>
        <div className="Weather">
          <div className="Weather-ico" onClick={this.#toggleWeather.bind(this)}>
            <img src={raining ? "rainy.svg" : "sunny.svg"} alt={raining ? "Rainy" : "Sunny"} />
          </div>
        </div>
      </div>
    )
  }

  componentDidMount() {
    // Create WebSocket connection.
    this.#ws = new WebSocket(`ws://${BFF_ADDRESS}`);

    // Connection opened
    this.#ws.addEventListener("open", (event) => {
      setTimeout(() => {
        this.#ws.send("Hello Server!");
      }, 100);
    });

    // Listen for messages
    this.#ws.addEventListener("message", (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as WSData;
      switch(msg.topic) {
        case "garden/status":
          this.setState({...this.state, garden: msg.data});
          break;
      }
    });

  }

  async #toggleWeather() {
    const raining = this.state.garden?.raining;
    const response = await fetch(`http://${BFF_ADDRESS}/weather/${raining ? "sunny" : "rainy"}`, {
      method: "POST"
    });
    if (response.status > 399) {
      const body = await response.json();
      alert(body.message);
    }
  }
}


export default App
