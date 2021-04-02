import * as React from "react";
import { render } from "react-dom";
import type { ClientState, ClientEvent } from "./app";

const ClientStateContext = React.createContext<{
  state: ClientState;
  dispatch: (event: ClientEvent) => void;
}>(null);

export class UiControl {
  container: HTMLElement;
  dispatch: (event: ClientEvent) => void;

  constructor(container: HTMLElement, dispatch: (event: ClientEvent) => void) {
    this.container = container;
    this.dispatch = dispatch;
  }

  rerender(state: ClientState) {
    render(
      <ClientStateContext.Provider value={{ state, dispatch: this.dispatch }}>
        <Ui />
      </ClientStateContext.Provider>,
      this.container
    );
  }
}

function Ui() {
  const { state } = React.useContext(ClientStateContext);
  if (state.matches("picking_name")) {
    return <LoginScreen />;
  }
  return null;
}

function LoginScreen() {
  const { dispatch } = React.useContext(ClientStateContext);
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({
      type: "IDENTIFY",
      nickname: event.currentTarget.elements["nickname"].value,
    });
  }

  return (
    <div className="login-screen">
      <form onSubmit={handleSubmit} className="nickname-form">
        <p>
          Want a playable game? Checkout out{" "}
          <a href="https://stockheimer.dontcodethis.com/">Stockheimer</a>
        </p>
        <label>
          Nickname: <input name="nickname" type="text" />
        </label>
        <input type="submit" value="Play" />
      </form>
    </div>
  );
}
