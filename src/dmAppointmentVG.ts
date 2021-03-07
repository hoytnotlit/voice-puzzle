import { MachineConfig, actions, Action, assign, send } from "xstate";
import { loadGrammar } from './runparser'
import { parse } from './chartparser'
import { grammar as grmr } from './grammars/appointmentGrammar'

const gram = loadGrammar(grmr)

function getGrammarResult(recResult: string) {
    let res = parse(recResult.split(/\s+/), gram);
    return res.resultsForRule(gram.$root)[0];
}

function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')
}

function resolveYes(recResult: string): boolean {
    return recResult === 'yes' || (yesNoGrammar[recResult] && yesNoGrammar[recResult].affirmation == "yes")
}

function resolveNo(recResult: string): boolean {
    return recResult === 'no' || (yesNoGrammar[recResult] && yesNoGrammar[recResult].affirmation == "no")
}

function getDefaultRecogEvents(help_msg: string) {
    return [
        {
            cond: (context: SDSContext) => !!getGrammarResult(context.recResult),
            actions: assign((context: SDSContext) => {
                let meeting_obj = getGrammarResult(context.recResult).meeting;
                // don't overwrite existing results (eg. user says create meeting on friday 
                //-> go to state who -> go to state time)
                return {
                    person: context.person ? context.person : meeting_obj.person,
                    day: context.day ? context.day : meeting_obj.day,
                    time: context.time ? context.time : meeting_obj.time
                }
            }),
            target: "#main.redirect"
        },
        { target: '#main.stop', cond: (context: SDSContext) => context.recResult === 'stop' },
        {
            cond: (context: SDSContext) => context.recResult === 'help',
            actions: getHelpAction(help_msg),
            target: '#main.help'
        },
        { target: ".nomatch" }
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
            target: "#main.init"
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
                entry: [send('LISTEN'), send('MAXSPEECH', { delay: 5000, id: 'maxsp' })]
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

const yesNoGrammar: { [index: string]: { person?: string, day?: string, time?: string, affirmation?: string } } = {
    "of course": { affirmation: "yes" },
    "absolutely": { affirmation: "yes" },
    "no way": { affirmation: "no" },
    "not really": { affirmation: "no" }
}

// NOTES AND COMMENTS

// I did not find the use of orthogonal states necessary, but I did implemeted them for the sake
// of the assignment by adding two parallel states where one state asks the user an open ended 
// question and the other state "listens" to what the user might say, ready to redirect to
// the correct state. The solution is slightly incomplete and the start state at the moment
// has no real functionality implemented. I tried adding another action (timer) but when 
// the user enters that state, they come back to the listen-state so this did not work well.
// The same thing happens when stopping, the initial state is listen so the program never "stops"

// Unexpected inputs in the start.welcome-state are not handled. I tried adding a nomatch-state
// that would tell the user the actions that can be done but this needs some condition
// to check if the user is already in another state in the parallel state. I couldn't find a solution
// for these issues for the moment.

// example utterances that work:
// meeting with Bob
// create a meeting with Bob
// create a meeting with Bob on Friday
// create a meeting with Bob on Friday at noon
// create a meeting with Bob at noon
// create a meeting with Bob at noon on Friday
// create a meeting on Friday
// create a meeting at noon

// The same grammar is also used for questions answered in states who, day and time
// so utterances "with Bob", "on Friday", "at noon" would work too, even though
// this behavious is a bit illogical (Q: "what would you like to do" A: "with Bob")

// I have increased the timeouts because 3 seconds was too short to wait for some answers

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    type: 'parallel',
    states: {
        start: {
            id: "start",
            initial: 'init',
            states: {
                init: {
                    on: {
                        CLICK: 'welcome'
                    }
                },
                welcome: {
                    initial: "prompt",
                    on: {
                        RECOGNISED: [
                            // NOTE in this block we could add other actions (eg timer, to do list from 
                            // lab2) and redirect accordingly
                            // { cond: (context) => context.recResult == "set timer", target: "#main.timer" },
                            { target: ".idle" }
                            // { target: ".nomatch" }
                        ]
                    },
                    states: {
                        prompt: {
                            entry: say("What would you like to do?"),
                            on: { ENDSPEECH: "ask" }
                        },
                        ask: {
                            entry: listen()
                        },
                        nomatch: {
                            entry: say("Currently I can only book an appointment or set a timer."),
                            on: { ENDSPEECH: "prompt" }
                        },
                        idle: {
                            // NOTE here I guess can be implemented a listener for stop/help/etc
                        },
                    }
                },
            }
        },
        actions: {
            id: "main",
            // initial: "appointment",
            initial: "init",
            states: {
                init: {
                    on: {
                        ENDSPEECH: 'listen'
                    }
                },
                listen: {
                    on: {
                        RECOGNISED: {
                            cond: (context) => !!getGrammarResult(context.recResult),
                            actions: assign((context) => {
                                let meeting_obj = getGrammarResult(context.recResult).meeting;
                                return { person: meeting_obj.person, day: meeting_obj.day, time: meeting_obj.time }
                            }),
                            target: "redirect"
                        }
                    },
                    entry: listen()
                },
                redirect: {
                    always: [
                        { target: '#appointment.confirmTime', cond: (context) => !!context.person && !!context.day && !!context.time },
                        { target: '#appointment.duration', cond: (context) => !!context.person && !!context.day },
                        { target: '#appointment.day', cond: (context) => !!context.person },
                        { target: '#appointment.who', cond: (context) => !context.person && (!!context.day || !!context.time) },
                        { target: '#appointment.welcome' }
                    ]
                },
                appointment: {
                    id: 'appointment',
                    initial: 'welcome',
                    states: {
                        hist: { type: 'history', history: 'deep' },
                        welcome: {
                            initial: "prompt",
                            on: { ENDSPEECH: "who" },
                            states: {
                                prompt: { entry: say("Let's create an appointment") }
                            }
                        },
                        who: {
                            on: {
                                RECOGNISED: [...getDefaultRecogEvents("Tell me the name of the person.")],
                                MAXSPEECH: [...getDefaultMaxSpeechEvents()]
                            },
                            ...getDefaultStates(say("Who are you meeting with?"),
                                say("Can you tell me who you are meeting with?"),
                                "Sorry, I don't know them.")
                        },
                        day: {
                            on: {
                                RECOGNISED: [...getDefaultRecogEvents("Tell me the day of the meeting.")],
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
                                RECOGNISED: [...getDefaultRecogEvents("Tell me the time of your meeting.")],
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
                                "Yes or a no?")
                        },
                        final: {
                            initial: "prompt",
                            on: { ENDSPEECH: "#root.dm.start.init" },
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
                    always: 'init'
                },
                help: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: `${context.help_msg}`
                    })),
                    on: { ENDSPEECH: "appointment.hist" }
                },
                timer: {
                    entry: say("I will set a timer for you."),
                    always: 'init'
                }
            }
        }
    }
})
