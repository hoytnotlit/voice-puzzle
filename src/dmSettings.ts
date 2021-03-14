import { MachineConfig, send, Action, assign } from "xstate";

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
            states: {
                ...ask("What animal would you like to see?")
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