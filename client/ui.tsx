import * as React from "react";
import { render } from "react-dom";
import type { ClientState, ClientEvent } from "./client";

const ClientStateContext = React.createContext<{
  state: ClientState;
  dispatch: (event: ClientEvent) => void;
}>(null);

export class UiControl {
  constructor(private container: HTMLElement) {}

  rerender(state: ClientState, dispatch: (event: ClientEvent) => void) {
    render(
      <ClientStateContext.Provider value={{ state, dispatch }}>
        <Ui />
      </ClientStateContext.Provider>,
      this.container
    );
  }
}

function Ui() {
  const { state } = React.useContext(ClientStateContext);
  if (state.matches("unidentified")) {
    return <LoginScreen />;
  }
  return null;
}

function LoginScreen() {
  const { dispatch, state } = React.useContext(ClientStateContext);
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({
      type: "IDENTIFY",
      nickname: event.currentTarget.elements["nickname"].value,
    });
  }

  const isWaitingForConfirm = state.matches("unidentified.waiting_for_confirm");
  const rejectReson = state.context.identityRejectReason;

  return (
    <div className="login-screen">
      <form onSubmit={handleSubmit} className="nickname-form">
        {isWaitingForConfirm ? (
          <p>joining in...</p>
        ) : rejectReson != null ? (
          <p>{rejectReson}</p>
        ) : (
          <p>
            Want a playable game? Checkout out{" "}
            <a href="https://stockheimer.dontcodethis.com/">Stockheimer</a>
          </p>
        )}
        <label>
          Nickname:{" "}
          <input name="nickname" type="text" disabled={isWaitingForConfirm} />
        </label>
        <input type="submit" value="Play" />
      </form>
    </div>
  );
}
