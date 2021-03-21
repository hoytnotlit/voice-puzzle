import { MachineConfig, send, Action, assign, TransitionConfigOrTarget } from "xstate";
import { loadGrammar } from './runparser';
import { parse } from './chartparser';
import { grammar } from './grammars/puzzleGrammar';

const gram = loadGrammar(grammar);
const commands = ["help", "reset", "stop"];

function getGrammarResult(recResult: string) {
    let res = parse(recResult.toLowerCase().split(/\s+/), gram);

    // return undefined if grammar result is not found
    return res.resultsForRule(gram.$root)[0] ?
        res.resultsForRule(gram.$root)[0].puzzleMove : undefined;
}

function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function getDefaultStates(prompt: string): any {
    return {
        prompt: {
            on: { ENDSPEECH: "listen" },
            entry: send((context) => ({
                type: "SPEAK",
                value: prompt
            })),
        },
        reprompt: {
            on: { ENDSPEECH: "listen" },
            entry: send((context: SDSContext) => ({
                type: "SPEAK",
                value: `I heard you say ${context.recResult}. Could you repeat what you mean?`
            })),
        },
        listen: {
            entry: send('LISTEN')
        }
    }
}

function getDefaultEvents(help_msg: string): any {
    return [
        {
            target: "redirect",
            cond: (context: SDSContext) => getGrammarResult(context.recResult),
            actions: assign((context: SDSContext) => {
                return {
                    piece: context.piece ? context.piece : getGrammarResult(context.recResult).piece,
                    degree: context.degree ? context.degree : getGrammarResult(context.recResult).degree,
                    direction: context.direction ? context.direction : getGrammarResult(context.recResult).direction,
                }
            }),
        },
        {
            cond: (context: SDSContext) => context.recResult === "help",
            actions: assign((context: SDSContext) => { return { help_msg: help_msg } }),
            target: "#root.dm.help"
        },
        // reprompt on unrecognised
        {
            target: ".reprompt",
            cond: (context: SDSContext) => commands.indexOf(context.recResult) < 0,
        }
    ]
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
                RECOGNISED: {
                    cond: (context) => context.recResult === "reset" || context.recResult === "stop",
                    target: "#root.dm.reset"
                }
            },
            id: "play",
            initial: "piece",
            states: {
                hist: {
                    type: 'history',
                    history: 'shallow'
                },
                // redirect user to correct substate based on how much information they give
                redirect: {
                    always: [
                        {
                            target: '#root.dm.rotate',
                            cond: (context) => context.piece !== undefined
                                && context.degree !== undefined
                                && context.direction !== undefined
                        },
                        // if degree is twice/180, dont bother asking for direction
                        {
                            target: '#root.dm.rotate',
                            cond: (context) => context.piece !== undefined
                                && context.degree === 180
                        },
                        {
                            target: '#play.direction',
                            cond: (context) => context.piece !== undefined
                                && context.pieceSelected === true
                                && context.degree !== undefined
                        },
                        {
                            target: '#play.degree',
                            cond: (context) => context.piece !== undefined
                                && context.pieceSelected === true
                        },
                        // select piece also in case like "top left 90 degrees" as the first utterance
                        {
                            target: '#root.dm.select',
                            cond: (context) => context.piece !== undefined ||
                                (context.piece !== undefined
                                    && context.degree !== undefined),
                        },
                        // go back to piece state if it has not been specified
                        // in case of only "right" reset the direction
                        {
                            target: "piece",
                            actions: assign((context) => {
                                return {
                                    direction: undefined
                                }
                            })
                        }
                    ]
                },
                piece: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            ...getDefaultEvents("First tell me the row name and then the column name.")
                        ]
                    },
                    states: {
                        ...getDefaultStates("Which piece would you like to rotate?")
                    }
                },
                degree: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            ...getDefaultEvents("Tell me either a degree or a number of times to rotate.")
                        ]
                    },
                    states: {
                        ...getDefaultStates("How much do you want to rotate it?")
                    }
                },
                direction: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            ...getDefaultEvents("I can go either clockwise or counter clockwise.")
                        ]
                    },
                    states: {
                        ...getDefaultStates("In which direction should I rotate it?")
                    }
                }
            }
        },
        help: {
            on: { ENDSPEECH: "#root.dm.play.hist" },
            entry: send((context) => ({
                type: "SPEAK",
                value: `${context.help_msg}`
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
                    target: 'reset',
                    cond: (context) => context.recResult === "no"
                },
                {
                    target: 'welcome',
                    cond: (context) => context.recResult === "yes"
                }]
            },
            states: {
                ...getDefaultStates("You used up all your turns! Do you want to start over?")
            }
        },
        afterRotate: {
            on: { ENDSPEECH: "play" },
            entry: say("There you go! Let's continue.")
        },
        rotate: {
            on: {
                WIN: {
                    target: "win",
                    actions: assign((context) => {
                        return {
                            piece: undefined,
                            degree: undefined,
                            direction: undefined,
                            moves: undefined,
                            pieceSelected: false
                        }
                    }),
                },
                CONTINUE: {
                    target: "afterRotate",
                    actions: assign((context) => {
                        // reset moves after each turn
                        return {
                            piece: undefined,
                            degree: undefined,
                            direction: undefined,
                            pieceSelected: false,
                            moves: context.moves ? context.moves + 1 : 1
                        }
                    }),
                },
                LOSE: {
                    target: "lose",
                    actions: assign((context) => {
                        return {
                            piece: undefined,
                            degree: undefined,
                            direction: undefined,
                            moves: undefined,
                            pieceSelected: false
                        }
                    }),
                }
            },
            entry: "rotatePiece",
        },
        select: {
            entry: "selectPiece",
            always: {
                target: "play.redirect",
                actions: assign((context) => {
                    return {
                        pieceSelected: true
                    }
                }),
            }
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