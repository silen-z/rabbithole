import React from "react";
import { render } from "react-dom";
import type { ClientState, ClientEvent } from "./client.ts";

interface ClientStateContext {
  state: ClientState;
  dispatch: (event: ClientEvent) => void;
}
const ClientStateContext = React.createContext<ClientStateContext>(null!);

export class Ui {
  constructor(private container: HTMLElement) {}

  update(state: ClientState, dispatch: (event: ClientEvent) => void) {
    render(
      <ClientStateContext.Provider value={{ state, dispatch }}>
        <UiComponent />
      </ClientStateContext.Provider>,
      this.container
    );
  }
}

function UiComponent() {
  const { state } = React.useContext(ClientStateContext);
  if (state.matches("unidentified")) {
    return <LoginScreen />;
  }
  return null;
}

interface JoinFormElements extends HTMLFormControlsCollection {
  nickname: HTMLInputElement;
}

function LoginScreen() {
  const { dispatch, state } = React.useContext(ClientStateContext);
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inputs = event.currentTarget.elements as JoinFormElements;
    dispatch({
      type: "IDENTIFY",
      nickname: inputs.nickname.value,
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
            Want a playable game? Checkout out <a href="https://stockheimer.dontcodethis.com/">Stockheimer</a>
          </p>
        )}
        <label>
          Nickname: <input name="nickname" type="text" disabled={isWaitingForConfirm} />
        </label>
        <input type="submit" value="Play" />
      </form>
    </div>
  );
}
