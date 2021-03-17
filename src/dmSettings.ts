import { MachineConfig, send, Action, assign } from "xstate";
import { init } from "xstate/lib/actionTypes";

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

const proxyUrl = "https://cors-anywhere.herokuapp.com/";
const getImageQuery = (query: string) =>
    fetch(new Request(proxyUrl + `https://api.duckduckgo.com/?q=${query}&format=json&skip_disambig=1`,
        { headers: { 'Origin': 'http://localhost:3000' } })).then(data => data.json());

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
                        cond: (context) => context.recResult == "image",
                    },
                    {
                        target: 'mode',
                        cond: (context) => context.recResult == "mode",
                    }
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
                ...ask("What animal would you like to see?"),
                // a state to inform user to wait for result
                afterAnswer: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Good choice. Give me just a second and I will get an image of that for you.`
                    })),
                    on: { ENDSPEECH: "query" }
                },
                query: {
                    invoke: {
                        id: 'duck',
                        src: (context, event) => getImageQuery(context.recResult),
                        onDone: {
                            target: 'change',
                            actions: assign((context, event) => {
                                return {
                                    image: "http://duckduckgo.com" + event.data.Image
                                }
                            }),
                            cond: (context, event) => event.data.Image !== undefined
                        },
                        onError: {
                            target: 'error',
                            actions: (context, event) => console.log(event.data)
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