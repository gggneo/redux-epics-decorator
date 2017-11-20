import 'reflect-metadata'
import { map } from 'rxjs/operators/map'
import { Store } from 'redux'
import { Action as ReduxAction, createAction, ActionFunction0, Reducer as ReduxReducer } from 'redux-actions'
import { Observable } from 'rxjs/Observable'
import { ofType } from 'redux-observable'

import {
  symbolNamespace,
  symbolDispatch,
  symbolEpics,
  symbolAction,
  symbolNotTrasfer,
  routerActionNamespace,
  withNamespace,
  withReducer
} from '../symbol'
import { startsWith } from '../startsWith'
import { EpicAction } from '../interface'
import { EffectModule } from '../EffectModule'
import { currentReducers, currentSetEffectQueue } from '../shared'

export interface EffectHandler {
  createActionPayloadCreator?: any
  createActionMetaCreator?: any
  [actionName: string]: ReduxReducer<any, any>
}

export function Effect (handler: EffectHandler = {}) {
  return <Target extends EffectModule<any>>(target: Target, method: string, descriptor: PropertyDescriptor) => {
    let startAction: ActionFunction0<ReduxAction<void>>
    let name: string
    const constructor = target.constructor
    const epic: <Input, Output, ActionType extends (keyof Target)>(action$: Observable<Input>, store?: Store<any>) =>
      Observable<EpicAction<ActionType, Output>> =
        function (this: EffectModule<any>, action$: Observable<any>, store?: Store<any>) {
          const matchedAction$ = action$
            .pipe(
              ofType(startAction.toString()),
              map(({ payload }) => payload)
            )
          return descriptor.value.call(this, matchedAction$, store)
            .pipe(
              map((actionResult: ReduxAction<any>) => {
                const { type } = actionResult
                return {
                  ...actionResult,
                  type: (actionResult[symbolNotTrasfer] || startsWith(actionResult.type, routerActionNamespace)) ?
                    type :
                    withReducer(name, method, type)
                }
              })
            )
        }

    const setup = () => {
      name = Reflect.getMetadata(symbolNamespace, constructor)
      const dispatchs = Reflect.getMetadata(symbolDispatch, constructor)
      const epics = Reflect.getMetadata(symbolEpics, constructor)
      const actionWithNamespace = withNamespace(name, method)
      const { createActionPayloadCreator, createActionMetaCreator, ...reducer } = handler
      startAction = createAction(actionWithNamespace, createActionPayloadCreator, createActionMetaCreator)

      Object.keys(reducer)
        .forEach(key => {
          currentReducers.set(withReducer(name, method, key), handler[key])
        })

      dispatchs[method] = startAction
      epics.push(epic)

      Object.defineProperty(epic, symbolAction, {
        enumerable: false,
        configurable: false,
        value: startAction
      })

    }

    currentSetEffectQueue.push(setup)

    return {
      ...descriptor,
      value: epic as any
    }
  }
}
