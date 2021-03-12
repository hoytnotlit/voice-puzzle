import { MachineConfig, send, Action, assign } from "xstate";

// use srgs grammar - TODO or maybe rasa would be handier?
import { loadGrammar } from './runparser'
import { parse } from './chartparser'
import { grammar } from './grammars/puzzleGrammar'

const gram = loadGrammar(grammar)

function getGrammarResult(recResult: string) {
    let res = parse(recResult.toLowerCase().split(/\s+/), gram);

    // return empty object if grammar result is not found
    return res.resultsForRule(gram.$root)[0] ?
        res.resultsForRule(gram.$root)[0].puzzleMove : {};
}

function ask(prompt: string) {
    // TODO
}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            on: { ENDSPEECH: "shuffle" },
            entry: send((context) => ({
                type: "SPEAK",
                value: "Welcome here"
            })),
        },
        play: {
            id: "play",
            initial: "piece",
            states: {
                piece: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.rotate',
                                cond: (context) => getGrammarResult(context.recResult).piece && getGrammarResult(context.recResult).degree,
                                actions: assign((context) => {
                                    let grmRes = getGrammarResult(context.recResult);
                                    return { piece: grmRes.piece, degree: grmRes.degree }
                                }),
                            },
                            {
                                target: "#root.dm.select",
                                // target: '#play.degree',
                                cond: (context) => getGrammarResult(context.recResult) && getGrammarResult(context.recResult).piece,
                                actions: assign((context) => { return { piece: getGrammarResult(context.recResult).piece } }),
                            },
                            { target: ".prompt" }
                        ]
                    },
                    states: {
                        prompt: {
                            on: { ENDSPEECH: "listen" },
                            entry: send((context) => ({
                                type: "SPEAK",
                                value: "Which piece would you like to rotate?"
                            })),
                        },
                        listen: {
                            entry: send('LISTEN')
                        }
                    }
                },
                degree: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            {
                                target: '#play.direction',
                                // target: '#root.dm.rotate',
                                cond: (context) => getGrammarResult(context.recResult).degree,
                                actions: assign((context) => { return { degree: getGrammarResult(context.recResult).degree } }),
                            },
                            { target: ".prompt" }
                        ]
                    },
                    states: {
                        prompt: {
                            on: { ENDSPEECH: "listen" },
                            entry: send((context) => ({
                                type: "SPEAK",
                                value: "How much do you want to rotate it?"
                            })),
                        },
                        listen: {
                            entry: send('LISTEN')
                        }
                    }
                },
                direction: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            {
                                target: '#root.dm.rotate',
                                cond: (context) => getGrammarResult(context.recResult).direction,
                                actions: assign((context) => { return { direction: getGrammarResult(context.recResult).direction } }),
                            },
                            { target: ".prompt" }
                        ]
                    },
                    states: {
                        prompt: {
                            on: { ENDSPEECH: "listen" },
                            entry: send((context) => ({
                                type: "SPEAK",
                                value: "In which direction should I rotate it?"
                            })),
                        },
                        listen: {
                            entry: send('LISTEN')
                        }
                    }
                }
            }
        },
        rotate: {
            entry: "rotatePiece",
            always: "play"
        },
        select: {
            entry: "selectPiece",
            always: "play.degree"
        },
        shuffle: {
            entry: "shufflePieces",
            always: "play"
        },
        reset: {
            entry: "resetBoard",
            always: "init"
        }
    }
})