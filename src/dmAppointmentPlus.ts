import { MachineConfig, actions, Action, assign } from "xstate";
const { send, cancel } = actions;

function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')
}

function resolveYes(recResult: string): boolean {
    return recResult === 'yes' || (grammar[recResult] && grammar[recResult].affirmation == "yes")
}

function resolveNo(recResult: string): boolean {
    return recResult === 'no' || (grammar[recResult] && grammar[recResult].affirmation == "no")
}

function getDefaultRecogEvents(help_msg: string) {
    return [
        // another way to implement the stop-state
        // { target: '#appointment.stop', cond: (context: SDSContext) => context.recResult === 'stop' },
        {
            cond: (context: SDSContext) => context.recResult === 'help',
            actions: getHelpAction(help_msg),
            target: '#appointment.help'
        },
        {
            cond: (context: SDSContext) => context.recResult !== 'stop',
            target: ".nomatch"
        }
    ]
}

function getDefaultMaxSpeechEvents() {
    return [
        {
            actions: getRepromptAction(),
            cond: (context: SDSContext) => !context.prompts || context.prompts < 3,
            target: ".reprompt"
        },
        {
            actions: getClearRepromptAction(),
            cond: (context: SDSContext) => context.prompts >= 3,
            target: "init"
        }
    ]
}

function getDefaultStates(prompt: Action<SDSContext, SDSEvent>, reprompt: Action<SDSContext, SDSEvent>,
    nomatch: string): MachineConfig<SDSContext, any, SDSEvent> {
    return ({
        initial: 'prompt',
        states: {
            prompt: {
                entry: prompt,
                on: { ENDSPEECH: "ask" }
            },
            reprompt: {
                entry: reprompt,
                on: { ENDSPEECH: "ask" }
            },
            ask: {
                entry: [listen(), send('MAXSPEECH', { delay: 3000, id: 'maxsp' })]
            },
            nomatch: {
                entry: say(nomatch),
                on: { ENDSPEECH: "reprompt" }
            }
        }
    })
}

// functions for getting assign-actions, my editor gives an error when the result is 
// directly in the actions: ... part

function getHelpAction(help_msg: string): any {
    return assign((context) => { return { help_msg: help_msg } });
}

function getRepromptAction(): any {
    return assign((context: SDSContext) => { return { prompts: context.prompts ? context.prompts + 1 : 1 } });
}

function getClearRepromptAction(): any {
    return assign((context: SDSContext) => { return { prompts: 0 } });
}

const grammar: { [index: string]: { person?: string, day?: string, time?: string, affirmation?: string } } = {
    "Anna": { person: "Anna Appleseed" },
    "John": { person: "John Appleseed" },
    "Patricia": { person: "Patricia G" },
    "Mary": { person: "Mary" },
    "Bob": { person: "Bob the Builder" },
    "Mike": { person: "Michael" },
    "on Friday": { day: "Friday" },
    "tomorrow": { day: "tomorrow" },
    "Monday": { day: "Monday" },
    "10": { time: "10:00" },
    "at ten": { time: "10:00" },
    "at 10": { time: "10:00" },
    "eleven": { time: "11:00" },
    "at noon": { time: "12:00" },
    "at 3": { time: "15:00" },
    "of course": { affirmation: "yes" },
    "absolutely": { affirmation: "yes" },
    "no way": { affirmation: "no" },
    "not really": { affirmation: "no" }
}

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    id: 'appointment',
    initial: 'act',
    on: {
        RECOGNISED: {
            target: '.stop',
            cond: (context: SDSContext) => context.recResult === 'stop'
        }
    },
    states: {
        act: {
            initial: 'init',
            // NOTE use welcome as initial state if machine was imported in dmPrompt-machine
            // currently dmAppointmentPlus is the "main" machine (imported in idex.tsx)
            // initial: 'welcome',
            states: {
                hist: { type: 'history', history: 'deep' },
                init: {
                    on: {
                        CLICK: 'welcome'
                    }
                },
                welcome: {
                    initial: "prompt",
                    on: { ENDSPEECH: "who" },
                    states: {
                        prompt: { entry: say("Let's create an appointment") }
                    }
                },
                who: {
                    on: {
                        RECOGNISED: [{
                            cond: (context) => "person" in (grammar[context.recResult] || {}),
                            actions: assign((context) => { return { person: grammar[context.recResult].person } }),
                            target: "day"
                        },
                        ...getDefaultRecogEvents("Tell me the name of the person.")],
                        MAXSPEECH: [...getDefaultMaxSpeechEvents()]
                    },
                    ...getDefaultStates(say("Who are you meeting with?"),
                        say("Can you tell me who you are meeting with?"),
                        "Sorry, I don't know them.")
                },
                day: {
                    on: {
                        RECOGNISED: [{
                            cond: (context) => "day" in (grammar[context.recResult] || {}),
                            actions: assign((context) => { return { day: grammar[context.recResult].day } }),
                            target: "duration"
                        },
                        ...getDefaultRecogEvents("Tell me the day of the meeting.")],
                        MAXSPEECH: [...getDefaultMaxSpeechEvents()]
                    },
                    ...getDefaultStates(send((context) => ({
                        type: "SPEAK",
                        value: `OK. ${context.person}. On which day is your meeting?`
                    })),
                        say("What day do you have your meeting?"),
                        "Can you repeat that?")
                },
                duration: {
                    on: {
                        RECOGNISED: [
                            { target: 'confirmDay', cond: (context) => resolveYes(context.recResult) },
                            { target: 'time', cond: (context) => resolveNo(context.recResult) },
                            ...getDefaultRecogEvents("Tell me yes or no."),
                        ],
                        MAXSPEECH: [...getDefaultMaxSpeechEvents()]
                    },
                    ...getDefaultStates(say("Will it take the whole day?"),
                        say("Is your meeting going to last the entire day?"),
                        "I did not catch that.")
                },
                time: {
                    on: {
                        RECOGNISED: [{
                            cond: (context) => "time" in (grammar[context.recResult] || {}),
                            actions: assign((context) => { return { time: grammar[context.recResult].time } }),
                            target: "confirmTime",
                        },
                        ...getDefaultRecogEvents("Tell me the time of your meeting.")],
                        MAXSPEECH: [...getDefaultMaxSpeechEvents()]
                    },
                    ...getDefaultStates(say("What time is your meeting?"),
                        say("When does your meeting start?"),
                        "Can you repeat that?")
                },
                confirmDay: {
                    on: {
                        RECOGNISED: [
                            { target: 'final', cond: (context) => resolveYes(context.recResult) },
                            { target: 'welcome', cond: (context) => resolveNo(context.recResult) },
                            ...getDefaultRecogEvents("Tell me yes or no.")
                        ],
                        MAXSPEECH: [...getDefaultMaxSpeechEvents()]
                    },
                    ...getDefaultStates(
                        send((context) => ({
                            type: "SPEAK",
                            value: `Do you want me to create an appointment with ${context.person} on ${context.day} for the whole day?`
                        })),
                        send((context) => ({
                            type: "SPEAK",
                            value: `You are meeting with ${context.person} on ${context.day} for the whole day. Is that correct?`
                        })),
                        "Yes or no?")
                },
                confirmTime: {
                    on: {
                        RECOGNISED: [
                            { target: 'final', cond: (context) => resolveYes(context.recResult) },
                            { target: 'welcome', cond: (context) => resolveNo(context.recResult) },
                            ...getDefaultRecogEvents("Tell me yes or no.")
                        ],
                        MAXSPEECH: [...getDefaultMaxSpeechEvents()]
                    },
                    ...getDefaultStates(
                        send((context) => ({
                            type: "SPEAK",
                            value: `Do you want me to create an appointment with ${context.person} on ${context.day} at ${context.time}?`
                        })),
                        send((context) => ({
                            type: "SPEAK",
                            value: `You are meeting with ${context.person} on ${context.day} at ${context.time}. Is that correct?`
                        })),
                        "Yes or no?")
                },
                final: {
                    initial: "prompt",
                    on: { ENDSPEECH: "init" },
                    states: {
                        prompt: {
                            entry: say("Your appointment has been created!")
                        }
                    }
                },
            }
        },
        stop: {
            entry: say("Ok"),
            always: 'act'
        },
        help: {
            entry: send((context) => ({
                type: "SPEAK",
                value: `${context.help_msg}`
            })),
            on: { ENDSPEECH: "act.hist" }
        }
    }
})
