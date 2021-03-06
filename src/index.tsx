import "./styles.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Machine, assign, actions, State } from "xstate";
import { useMachine, asEffect } from "@xstate/react";
import { inspect } from "@xstate/inspect";
import { dmMachine as dmMachinePuzzle } from "./dmPuzzle";
import { dmMachine as dmMachineSettings } from "./dmSettings";
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
                ...dmMachinePuzzle,
            },
            settings: {
                ...dmMachineSettings,
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
                                    ),
                                ],
                                target: "idle",
                            }
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
                console.log("<< ASR: " + context.recResult);
            },
            test: () => {
                console.log("test");
            },
            // logIntent: (context: SDSContext) => {
            //     console.log("<< NLU intent: " + context.nluData.intent.name);
            // },
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
                <button type="button"{...props}>
                    Listening...
                </button>
            );
        case props.state.matches({ asrtts: "speaking" }):
            return (
                <button type="button" {...props}>
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

// track when user has solved the puzzle
let finishedPiecesCount = 0
const piecesCount = 9

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
                    // get the new degree
                    let currDegree = piece.style.transform.match(/\d+/)[0];
                    let degree = getDegree(parseInt(currDegree), parseInt(context.degree),
                        context.direction);
                    piece.style.transform = `rotate(${degree}deg)`; // set degree as rotate value
                    piece.classList.remove("selected"); // remove selected class

                    // track pieces that are turned the right way (at 0 degrees)
                    if (parseInt(currDegree) === 0 && degree !== 0) finishedPiecesCount--;
                    if (degree === 0) finishedPiecesCount++;

                    // in hard mode allow user to try only as many times as there are pieces
                    // trigger win or continue event based on count of "finished" pieces 
                    if (context.mode === "hard" && context.moves === piecesCount)
                        send("LOSE");
                    else if (finishedPiecesCount === piecesCount)
                        send("WIN");
                    else
                        send("CONTINUE");
                }
            }),
            shufflePieces: asEffect((context) => {
                const board = document.getElementById("board");
                const labels = document.getElementById("labels");
                const info = document.getElementById("info");

                if (board) {
                    board.classList.add("playing");
                    labels.classList.remove("hidden");
                    info.classList.remove("hidden");

                    const pieces = board.children;

                    let degrees = [90, 180, 270];
                    // include 0 degrees (no rotation) only in normal mode
                    if (context.mode !== "hard") {
                        degrees.push(0);
                    }

                    for (let i = 0; i < pieces.length; i++) {
                        const htmlElement = document.getElementById(pieces[i].id);

                        // typescript forcing strict null checks
                        if (htmlElement) {
                            let randomDegree = degrees[Math.floor(Math.random() * degrees.length)];
                            htmlElement.style.transform = `rotate(${randomDegree}deg)`;

                            if (randomDegree === 0) finishedPiecesCount++;
                        }
                    }
                }
            }),
            resetBoard: asEffect((context) => {
                const board = document.getElementById("board");
                const labels = document.getElementById("labels");
                const info = document.getElementById("info");
                if (board) {
                    // reset classes to hide things
                    board.classList.remove("playing");
                    labels.classList.add("hidden");
                    info.classList.add("hidden");

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
            changeImage: asEffect((context) => {
                const board = document.getElementById("board");
                if (board) {
                    board.classList.remove("playing");
                    const pieces = board.children;

                    for (let i = 0; i < pieces.length; i++) {
                        const htmlElement = document.getElementById(pieces[i].id);

                        // typescript forcing strict null checks
                        if (htmlElement) htmlElement.style.backgroundImage = `url(${context.image})`;
                    }
                }
            })
        },
    });

    return (
        <div className="App">
            <div className="btn-wrapper">
                <ReactiveButton state={current} onClick={() => send("CLICK")} />
                <button type="button" className="settings-btn" onClick={() => send("SETTINGS")}>Settings</button>
            </div>

            {renderSettings(current.value)}
            {renderBoard()}

            <div className="info hidden" id="info">
                <span>
                    Say <b>help</b> at any point for a help message.
                    Want to stop playing? Say <b>reset</b> or <b>stop</b> and the pieces will be organized for you.
                </span>
            </div>

        </div>
    );
}

// get the puzzle piece board
function renderBoard() {
    return (
        <div>
            <div className="hidden" id="labels">
                <div className="column-names"><div><span>left</span></div><div><span>center</span></div><div><span>right</span></div></div>
                <div className="row-names"><div><span>top</span></div><div><span>middle</span></div><div><span>bottom</span></div></div>
            </div>

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

// get a visual of settings
function renderSettings(currentValue: any) {
    return (
        currentValue.settings !== "init" ?
            <div className="settings">Settings:
                <ul>
                    <li>Change mode</li>
                    <li>Change image</li>
                    <li>Exit</li>
                </ul></div> : null
    );
}

function getDegree(currDegree: number, degreeToRotate: number, direction: string): number {
    let degree = 0;

    // add or subtract degree and current degree, rotate to correct direction (default is right)
    if (direction == "left") {
        degree = currDegree - degreeToRotate;

        if (degree < 0)
            degree = currDegree + degreeToRotate;
    } else {
        degree = currDegree + degreeToRotate;

        if (degree > 360)
            degree = currDegree - degreeToRotate;
    }

    // don't exceed 360deg
    if (degree === 360) degree = 0;

    return degree;
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);