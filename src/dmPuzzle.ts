import { MachineConfig, send, Action, assign } from "xstate";

// use srgs grammar - TODO or maybe rasa would be handier?
import { loadGrammar } from './runparser';
import { parse } from './chartparser';
import { grammar } from './grammars/puzzleGrammar';

const gram = loadGrammar(grammar);
const commands = ["help", "reset"];

function getGrammarResult(recResult: string) {
    let res = parse(recResult.toLowerCase().split(/\s+/), gram);

    // return empty object if grammar result is not found
    return res.resultsForRule(gram.$root)[0] ?
        res.resultsForRule(gram.$root)[0].puzzleMove : {};
}

function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function ask(prompt: string): any {
    return {
        prompt: {
            on: { ENDSPEECH: "listen" },
            entry: send((context) => ({
                type: "SPEAK",
                value: prompt
            })),
        },
        listen: {
            entry: send('LISTEN')
        }
    }
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
            entry: say("Let's begin by shuffling the pieces.")
        },
        // just an extra state to add a bit more natural dialog
        afterShuffle: {
            on: { ENDSPEECH: "play" },
            entry: say("Now...")
        },
        play: {
            on: {
                RECOGNISED: [{
                    cond: (context) => context.recResult === "help",
                    target: "#root.dm.help"
                },
                {
                    cond: (context) => context.recResult === "reset",
                    target: "#root.dm.reset"
                },
                ]
            },
            id: "play",
            initial: "piece",
            states: {
                hist: {
                    type: 'history',
                    history: 'shallow' // TODO deep is better maybe?
                },
                // TODO redirect user to correct substate based on how much information they give
                redirect: {

                },
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
                                cond: (context) => getGrammarResult(context.recResult) && getGrammarResult(context.recResult).piece,
                                actions: assign((context) => { return { piece: getGrammarResult(context.recResult).piece } }),
                            },
                            {
                                target: ".prompt",
                                cond: (context) => commands.indexOf(context.recResult) < 0,
                            }
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
                                cond: (context) => getGrammarResult(context.recResult).degree,
                                actions: assign((context) => { return { degree: getGrammarResult(context.recResult).degree } }),
                            },
                            {
                                target: ".prompt",
                                cond: (context) => commands.indexOf(context.recResult) < 0,
                            }
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
                            {
                                target: ".prompt",
                                cond: (context) => commands.indexOf(context.recResult) < 0,
                            }
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
        help: {
            on: { ENDSPEECH: "#root.dm.play.hist" },
            entry: send((context) => ({
                type: "SPEAK",
                value: "Help is here!" // TODO specify help messages
            })),
        },
        win: {
            on: { ENDSPEECH: "init" },
            entry: say("You win! Congrats!")
        },
        lose: {
            initial: "prompt",
            on: {
                RECOGNISED: [{
                    target: 'init',
                    cond: (context) => context.recResult === "no"
                },
                {
                    target: 'welcome',
                    cond: (context) => context.recResult === "yes"
                }]
            },
            states: {
                ...ask("You lose! Sorry! Do you want to try again?")
            }
        },
        rotate: {
            on: {
                WIN: {
                    target: "win",
                    actions: assign((context) => { return { moves: undefined } }),
                },
                CONTINUE: {
                    target: "play",
                    actions: assign((context) => { return { moves: context.moves ? context.moves++ : 1 } }),
                },
                LOSE: {
                    target: "lose",
                    actions: assign((context) => { return { moves: undefined } }),
                }
            },
            entry: "rotatePiece",
            // always: "play"
        },
        select: {
            entry: "selectPiece",
            always: "play.degree"
        },
        shuffle: {
            entry: "shufflePieces",
            always: "afterShuffle"
        },
        reset: {
            entry: "resetBoard",
            always: "init"
        }
    }
})