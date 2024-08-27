import { Op, Precondition } from "model/op_log";
import { Refs, State, StateRefs } from "model/state";

import * as json from "model/json";


type CondState<S extends State> = S &  StateRefs;

function attachCond<C>(op: Op, cond: C) {

    if (op.payload.cond !== undefined) {
        throw new Error("Attempting to attach a condition to op " + json.hash(op));
    }

    op.payload.cond = cond;
}

/*function addCondition<S extends State, O extends Op>(precondition: Precondition<S, O>): Precondition<CondState<S>, O> {
    return (cs: CondState<S>, op: O, updatedRefs: Refs) => {

    }
}*/