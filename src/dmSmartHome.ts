import { MachineConfig, send, Action, assign } from "xstate";
// SRGS parser and example (logs the results to console on page load)
import { loadGrammar } from './runparser'
import { parse } from './chartparser'
import { grammar } from './grammars/smartHomeGrammar'

const gram = loadGrammar(grammar)

function getGrammarResult(recResult: string) {
    let res = parse(recResult.split(/\s+/), gram);
    return res.resultsForRule(gram.$root)[0];
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
            initial: "prompt",
            on: {
                RECOGNISED: {
                    target: 'speak',
                    actions: assign((context) => { return { smarthome_action: getGrammarResult(context.recResult) } }),
                }
            },
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        value: "How may I serve you?"
                    })),
                    on: { ENDSPEECH: "ask" }
                },
                ask: {
                    entry: send('LISTEN')
                }
            }
        },
        speak: {
            initial: "prompt",
            states: {
                prompt: {
                    entry: send((context) => ({
                        type: "SPEAK",
                        // NOTE this breaks when smarthome_action is undefined 
                        value: `Ok. ${context.smarthome_action.action} ${context.smarthome_action.object}`
                    }))
                }
            }
        }
    }
})
