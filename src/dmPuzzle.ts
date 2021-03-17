import { MachineConfig, send, Action, assign, TransitionConfigOrTarget } from "xstate";

// use srgs grammar - TODO or maybe rasa would be handier?
import { loadGrammar } from './runparser';
import { parse } from './chartparser';
import { grammar } from './grammars/puzzleGrammar';

const gram = loadGrammar(grammar);
const commands = ["help", "reset"];

function getGrammarResult(recResult: string) {
    let res = parse(recResult.toLowerCase().split(/\s+/), gram);

    console.log(res.resultsForRule(gram.$root)[0])
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
        listen: {
            entry: send('LISTEN')
        }
    }
}

// TODO what is the type really?
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
            actions: assign((context: SDSContext) => { return { help_msg: help_msg} }),
            target: "#root.dm.help"
        },
        {
            target: ".prompt",
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
                    cond: (context) => context.recResult === "reset",
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
                        // TODO if degree is twice/180, dont bother asking for direction
                        {
                            target: '#play.direction',
                            cond: (context) => context.piece !== undefined
                                && context.degree !== undefined
                        },
                        {
                            target: '#root.dm.select',
                            cond: (context) => context.piece !== undefined,
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
                    target: 'init',
                    cond: (context) => context.recResult === "no"
                },
                {
                    target: 'welcome',
                    cond: (context) => context.recResult === "yes"
                }]
            },
            states: {
                ...getDefaultStates("You lose! Sorry! Do you want to try again?")
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
                    actions: assign((context) => {
                        // reset moves after each turn
                        return {
                            piece: undefined,
                            degree: undefined,
                            direction: undefined,
                            moves: context.moves ? context.moves++ : 1
                        }
                    }),
                },
                LOSE: {
                    target: "lose",
                    actions: assign((context) => { return { moves: undefined } }),
                }
            },
            entry: "rotatePiece",
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