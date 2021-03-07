import { MachineConfig, send, Action, assign } from "xstate";
import { dmMachine as dmAppointmentMachine } from "./dmAppointment";
import { nluRequest } from "./index"

const confidence_threshold = 0.9;
const recognized_intents = ["appointment", "timer", "todo_item"];

function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    id: "main",
    initial: 'init',
    on: {
        RECOGNISED: { target: '.init', cond: (context) => context.recResult == "stop" }
    },
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            initial: "prompt",
            on: {
                RECOGNISED: { target: 'query' }
            },
            states: {
                prompt: {
                    entry: say("What would you like to do?"),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: send('LISTEN')
                }
            }
        },
        query: {
            on: {
                DONE: [
                    { target: 'confirm', cond: (context) => recognized_intents.indexOf(context.nluData.intent.name.toLowerCase()) > -1 && context.nluData.intent.confidence <= confidence_threshold },
                    { target: 'redirect', cond: (context) => recognized_intents.indexOf(context.nluData.intent.name.toLowerCase()) > -1 && context.nluData.intent.confidence > confidence_threshold },
                    { target: 'stop', cond: (context) => context.recResult === 'stop' },
                    { target: 'unknown' }
                ]
            },
            invoke: {
                id: 'nlu',
                src: (context, event) => nluRequest(context.recResult),
                onDone: {
                    actions: [assign((context, event) => { return { nluData: event.data } }),
                    send('DONE')]
                },
                onError: {
                    target: 'unknown',
                    actions: (context, event) => console.log(event.data),
                }
            }
        },
        confirm: {
            initial: "prompt",
            on: {
                RECOGNISED: [
                    { target: "redirect", cond: (context) => context.recResult == "yes" },
                    { target: "welcome" }]
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `Did you choose ${context.nluData.intent.name}?`
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: send('LISTEN')
                }
            }
        },
        redirect: {
            always: [
                { target: 'appointment', cond: (context) => context.nluData.intent.name.toLowerCase() == "appointment" },
                { target: 'todoitem', cond: (context) => context.nluData.intent.name.toLowerCase() == "todo_item" },
                { target: 'timer', cond: (context) => context.nluData.intent.name.toLowerCase() == "timer" },
                { target: 'stop', cond: (context) => context.recResult === 'stop' }
            ],
        },
        unknown: {
            initial: "prompt",
            on: {
                ENDSPEECH: { target: 'welcome' }
            },
            states: {
                prompt: {
                    entry: say("I did not understand that. I can create and appointment, set a timer or add an item to your to-do list for you.")
                }
            }
        },
        appointment: {
            ...dmAppointmentMachine
        },
        todoitem: {
            initial: "welcome",
            on: { ENDSPEECH: "init" },
            states: {
                welcome: {
                    entry: say("Let's create an item for your to-do list")
                }
            }
        },
        timer: {
            initial: "welcome",
            on: { ENDSPEECH: "init" },
            states: {
                welcome: {
                    entry: say("Let's set a timer")
                }
            }
        },
        stop: {
            entry: say("Ok"),
            always: 'init'
        }
    }
})
