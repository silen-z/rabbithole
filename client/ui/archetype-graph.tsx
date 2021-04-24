import React from "react";
import { graphviz } from "@hpcc-js/wasm";

type State = {
  graph?: string;
  error?: any;
};

const defaultState = {
  graph: undefined,
  error: undefined,
};

type Action = { type: "resolved"; payload: string } | { type: "rejected"; payload: any };

function reducer(state: State, action: Action) {
  switch (action.type) {
    case "resolved":
      return {
        graph: action.payload,
        error: null,
      };
    case "rejected":
      return {
        ...state,
        error: action.payload,
      };
  }
}

export function ArchetypeGraph(props: { graph?: string }) {
  const [{ graph: generatedSvg }, dispatch] = React.useReducer(reducer, defaultState);

  React.useEffect(() => {
    if (props.graph == null) {
      return;
    }

    let canceled = false;

    graphviz
      .dot(props.graph)
      .then((result) => {
        if (!canceled) {
          dispatch({ type: "resolved", payload: result });
        }
      })
      .catch((error) => {
        if (!canceled) {
          dispatch({ type: "rejected", payload: error });
        }
      });

    return () => {
      canceled = true;
    };
  }, [props.graph]);

  if (generatedSvg == null) {
    return null;
  }

  return <div dangerouslySetInnerHTML={{ __html: generatedSvg }}></div>;
}
