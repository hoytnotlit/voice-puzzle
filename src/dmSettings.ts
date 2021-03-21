import { MachineConfig, send, assign } from "xstate";
import { loadGrammar } from './runparser';
import { parse } from './chartparser';
import { grammar } from './grammars/settingsGrammar';

const gram = loadGrammar(grammar);

function getGrammarResult(recResult: string) {
    let res = parse(recResult.toLowerCase().split(/\s+/), gram);
    return res.resultsForRule(gram.$root)[0] ? res.resultsForRule(gram.$root)[0].setting : undefined;
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
    // allow user to exit at any point
    on: {
        RECOGNISED: {
            target: '#root.settings.init',
            cond: (context) => context.recResult == "exit",
        }
    },
    states: {
        init: {
            on: {
                SETTINGS: 'welcome'
            }
        },
        welcome: {
            initial: "prompt",
            on: {
                RECOGNISED: [
                    {
                        target: 'image',
                        cond: (context) => getGrammarResult(context.recResult) == "image",
                    },
                    {
                        target: 'mode',
                        cond: (context) => getGrammarResult(context.recResult) == "mode",
                    },
                    { target: ".prompt" }
                ]
            },
            states: {
                ...ask("Here are the settings. Which one would you like to select?")
            }
        },
        image: {
            initial: "prompt",
            on: {
                RECOGNISED: ".afterAnswer"
            },
            states: {
                ...ask("What would you like to see a picture of?"),
                // a state to inform user to wait for result
                afterAnswer: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Good choice. Give me just a second and I will get an image of that for you.`
                    })),
                    on: {
                        ENDSPEECH: {
                            target: "change",
                            actions: assign((context) => {
                                return {
                                    image: "https://source.unsplash.com/weekly?" + context.recResult
                                }
                            }),
                        }
                    }
                },
                change: {
                    entry: "changeImage",
                    always: "confirm",
                },
                confirm: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Here you go, a nice picture of ${context.recResult}`
                    })),
                    on: { ENDSPEECH: "#root.settings.init" }
                },
                error: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Something happened and I could not get your image. `
                    })),
                    on: { ENDSPEECH: "#root.settings.init" }
                }
            }
        },
        mode: {
            initial: "prompt",
            on: {
                RECOGNISED: [
                    {
                        target: '.confirm',
                        cond: (context) => context.recResult == "hard" || context.recResult == "normal",
                        actions: assign((context) => { return { mode: context.recResult } }),
                    },
                    {
                        target: '.prompt',
                    }
                ]
            },
            states: {
                ...ask("Do you want to play in normal or hard mode?"),
                confirm: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Okay let's play in ${context.mode} mode!`
                    })),
                    on: { ENDSPEECH: "#root.settings.init" }
                }
            }
        }
    }
})