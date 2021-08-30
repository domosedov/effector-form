import * as React from "react";
import {
  createStore,
  createEvent,
  createEffect,
  sample,
  guard,
  combine,
} from "effector-root";
import type { Store, Event } from "effector-root";
import { combineEvents } from "patronum/combine-events";
import { every } from "patronum/every";
import * as Yup from "yup";
import { useStore } from "effector-react";
import { createTextInput } from "./shared/factories/create-text-input-model";

const schema = Yup.string()
  .test({
    test: (v) => (v ? v.length > 0 : false),
    name: "required",
    message: "Поле обязательное",
  })
  .min(5);

const createForm = () => {};

const emailInput = createTextInput({
  name: "email",
  formPrefix: "test",
  schema,
  persist: true,
});

const passInput = createTextInput({
  name: "pass",
  formPrefix: "test",
  schema,
  persist: true,
});

const $isValid = every({
  predicate: true,
  stores: [emailInput.isValid, passInput.isValid],
});

const submit = createEvent();

sample({
  clock: submit,
  target: [emailInput.validate, passInput.validate],
});

$isValid.watch((isValid) => console.log({ isValid }));

const runValidate = combineEvents({
  events: [emailInput.validate, passInput.validate],
});

runValidate.watch((evt) => console.log(evt));

emailInput.validate();
// passInput.validate();

const App: React.FC = () => {
  const handleSubmit = (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    submit();
  };

  const errorMessage = useStore(passInput.errorMessage);

  return (
    <div>
      <pre>{errorMessage}</pre>
      <h1>Hello 12</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          ref={(el) => emailInput.setRef(el)}
          onChange={emailInput.onChange}
        />
        <input
          type="text"
          ref={(el) => passInput.setRef(el)}
          onChange={passInput.onChange}
        />
        <pre>{Math.random()}</pre>
        <button type="submit">Submit</button>
      </form>
      <button onClick={() => emailInput.focus()}>Focus</button>
    </div>
  );
};

export { App };
