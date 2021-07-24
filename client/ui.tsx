import { render, createContext, h } from "preact";
import { useContext, useState } from "preact/hooks";
import type { ClientState, ClientEvent } from "./client.ts";

interface ClientStateContext {
  state: ClientState;
  dispatch: (event: ClientEvent) => void;
}
const ClientStateContext = createContext<ClientStateContext>(null!);

export function renderUi(state: ClientState, dispatch: (event: ClientEvent) => void) {
  render(
    <ClientStateContext.Provider value={{ state, dispatch }}>
      <Screen />
      <DebugPanel />
    </ClientStateContext.Provider>,
    document.body
  );
}

function Screen() {
  const { state } = useContext(ClientStateContext);
  if (state.matches("unidentified")) {
    return <LoginScreen />;
  }
  return null;
}

interface JoinFormElements extends HTMLFormControlsCollection {
  nickname: HTMLInputElement;
}

function LoginScreen() {
  const { dispatch, state } = useContext(ClientStateContext);
  function handleSubmit(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const inputs = form.elements as JoinFormElements;
    dispatch({
      type: "IDENTIFY",
      nickname: inputs.nickname.value,
    });
  }

  const isWaitingForConfirm = state.matches("unidentified.waiting_for_confirm");
  const rejectReson = state.context.identityRejectReason;

  return (
    <div class="screen login-screen">
      <form onSubmit={handleSubmit} class="nickname-form">
        {isWaitingForConfirm ? (
          <p>joining in...</p>
        ) : rejectReson != null ? (
          <p>{rejectReson}</p>
        ) : (
          <p>
            Want a playable game? Check out <a href="https://stockheimer.dontcodethis.com/">Stockheimer</a>
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

function DebugPanel() {
  const { state } = useContext(ClientStateContext);

  const [isPanelOpen, setPanelOpen] = useState(false);

  if (!isPanelOpen) {
    return (
      <button class="debug-panel-open" onClick={() => setPanelOpen(true)}>
        debug
      </button>
    );
  }

  return (
    <div class="debug-panel">
      <button onClick={() => setPanelOpen(false)}>close debug panel</button>;
      <table class="debug-stats">
        <tbody>
          <tr>
            <td>Entities:</td>
            <td>{state.context.diagnostics?.entityCount}</td>
          </tr>
          <tr>
            <td>Components:</td>
            <td>{state.context.diagnostics?.registeredComponents.size}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
