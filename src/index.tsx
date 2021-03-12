import "./styles.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Machine, assign, actions, State } from "xstate";
import { useMachine, asEffect } from "@xstate/react";
import { inspect } from "@xstate/inspect";
import { dmMachine } from "./dmPuzzle";
const { send, cancel } = actions;

inspect({
    url: "https://statecharts.io/inspect",
    iframe: false,
});

import { useSpeechSynthesis, useSpeechRecognition } from "react-speech-kit";

const machine = Machine<SDSContext, any, SDSEvent>(
    {
        id: "root",
        type: "parallel",
        states: {
            dm: {
                ...dmMachine,
            },
            asrtts: {
                initial: "idle",
                states: {
                    idle: {
                        on: {
                            LISTEN: "recognising",
                            SPEAK: {
                                target: "speaking",
                                actions: assign((_context, event) => {
                                    return { ttsAgenda: event.value };
                                }),
                            },
                        },
                    },
                    recognising: {
                        initial: "progress",
                        entry: "recStart",
                        exit: "recStop",
                        on: {
                            ASRRESULT: {
                                actions: [
                                    "recLogResult",
                                    assign((_context, event) => {
                                        return { recResult: event.value };
                                    }),
                                ],
                                target: ".match",
                            },
                            RECOGNISED: {
                                actions: [
                                    cancel(
                                        "maxsp"
                                    ) /*, assign((context: SDSContext) => { return { prompts: 0 } })*/,
                                ],
                                target: "idle",
                            },
                            MAXSPEECH: "idle",
                        },
                        states: {
                            progress: {},
                            match: {
                                entry: send("RECOGNISED"),
                            },
                        },
                    },
                    speaking: {
                        entry: "ttsStart",
                        on: {
                            ENDSPEECH: "idle",
                        },
                    },
                },
            },
        },
    },
    {
        actions: {
            recLogResult: (context: SDSContext) => {
                /* context.recResult = event.recResult; */
                console.log("<< ASR: " + context.recResult);
            },
            test: () => {
                console.log("test");
            },
            logIntent: (context: SDSContext) => {
                /* context.nluData = event.data */
                console.log("<< NLU intent: " + context.nluData.intent.name);
            },
        },
    }
);

interface Props extends React.HTMLAttributes<HTMLElement> {
    state: State<SDSContext, any, any, any>;
}

const ReactiveButton = (props: Props): JSX.Element => {
    switch (true) {
        case props.state.matches({ asrtts: "recognising" }):
            return (
                <button
                    type="button"
                    className="glow-on-hover"
                    style={{ animation: "glowing 20s linear" }}
                    {...props}
                >
                    Listening...
                </button>
            );
        case props.state.matches({ asrtts: "speaking" }):
            return (
                <button
                    type="button"
                    className="glow-on-hover"
                    style={{ animation: "bordering 1s infinite" }}
                    {...props}
                >
                    Speaking...
                </button>
            );
        default:
            return (
                <button type="button" className="start-btn" {...props}>
                    Click to play
                </button>
            );
    }
};

function App() {
    const { speak, cancel, speaking } = useSpeechSynthesis({
        onEnd: () => {
            send("ENDSPEECH");
        },
    });
    const { listen, listening, stop } = useSpeechRecognition({
        onResult: (result: any) => {
            send({ type: "ASRRESULT", value: result });
        },
    });
    const [current, send, service] = useMachine(machine, {
        devTools: true,
        actions: {
            recStart: asEffect(() => {
                console.log("Ready to receive a command.");
                listen({
                    interimResults: false,
                    continuous: true,
                });
            }),
            recStop: asEffect(() => {
                console.log("Recognition stopped.");
                stop();
            }),
            ttsStart: asEffect((context, effect) => {
                console.log("Speaking...");
                speak({ text: context.ttsAgenda });
            }),
            ttsCancel: asEffect((context, effect) => {
                console.log("TTS STOP...");
                cancel();
            }),
            rotatePiece: asEffect((context) => {
                const pieceId = context.piece;
                const piece = document.getElementById(pieceId);

                if (piece) {
                    // TODO implement direction
                    
                    // add or subtract degree and current degree
                    let currDegree = piece.style.transform.match(/\d+/)[0];
                    let degree = parseInt(currDegree) + parseInt(context.degree);

                    // don't exceed 360deg
                    if (degree === 360) degree = 0;

                    if (degree > 360)
                        degree = parseInt(currDegree) - parseInt(context.degree);
                    piece.style.transform = `rotate(${degree}deg)`;
                    // remove selected class
                    piece.classList.remove("selected");
                }
            }),
            shufflePieces: asEffect((context) => {
                const board = document.getElementById("board");
                if (board) {
                    board.classList.add("playing");

                    const pieces = board.children;
                    // TODO include 0 here or not?
                    const degrees = [0, 90, 180, 270];

                    for (let i = 0; i < pieces.length; i++) {
                        let randomDegree =
                            degrees[Math.floor(Math.random() * degrees.length)];
                        const htmlElement = document.getElementById(pieces[i].id);

                        // typescript forcing strict null checks
                        if (htmlElement)
                            htmlElement.style.transform = `rotate(${randomDegree}deg)`;
                    }
                }
            }),
            resetBoard: asEffect((context) => {
                const board = document.getElementById("board");
                if (board) {
                    const pieces = board.children;

                    for (let i = 0; i < pieces.length; i++) {
                        const htmlElement = document.getElementById(pieces[i].id);

                        // typescript forcing strict null checks
                        if (htmlElement) htmlElement.style.transform = "rotate(0)";
                    }
                }
            }),
            selectPiece: asEffect((context) => {
                const pieceId = context.piece;
                const piece = document.getElementById(pieceId);

                if (piece) {
                    // apply selected styles to piece
                    let transformVal = piece.style.transform + " scale(1.1)";
                    piece.style.transform = transformVal;
                    piece.classList.add("selected");
                }
            }),
        },
    });

    return (
        <div className="App">
            <ReactiveButton state={current} onClick={() => send("CLICK")} />
            <div className="board" id="board">
                <div className="top-left" id="top-left"></div>
                <div className="top-center" id="top-center"></div>
                <div className="top-right" id="top-right"></div>
                <div className="middle-left" id="middle-left"></div>
                <div className="middle-center" id="middle-center"></div>
                <div className="middle-right" id="middle-right"></div>
                <div className="bottom-left" id="bottom-left"></div>
                <div className="bottom-center" id="bottom-center"></div>
                <div className="bottom-right" id="bottom-right"></div>
            </div>
        </div>
    );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);

/* RASA API
 *  */
// const proxyurl = "https://cors-anywhere.herokuapp.com/";
// const rasaurl = 'https://gussuvmi-rasa-nlu.herokuapp.com/model/parse';
// const origin = location.origin;

// export const nluRequest = (text: string) =>
//     fetch(new Request(proxyurl + rasaurl, {
//         method: 'POST',
//         headers: {
//             'Origin': origin //'http://maraev.me'
//         }, // only required with proxy
//         body: `{"text": "${text}"}`
//     }))
//         .then(data => data.json());
