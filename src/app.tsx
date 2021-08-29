import * as React from "react";
import {
  createStore,
  createEvent,
  createEffect,
  sample,
  guard,
  combine,
} from "effector-root";
import type { Store } from "effector-root";
import { combineEvents } from "patronum/combine-events";
import { every } from "patronum/every";
import * as Yup from "yup";

const schema = Yup.string()
  .test({
    test: (v) => (v ? v.length > 0 : false),
    name: "required",
    message: "Поле обязательное",
  })
  .min(5);

export type Nullable<T> = T | null;

type CreateTextInput = {
  name: string;
  schema?: Yup.StringSchema;
  formPrefix?: string;
  persist?: boolean;
};

/**
 * TODO
 * - Добавить isValidating
 * - Добавить onBlur
 * - Добавить публичный setValue, setError
 * - Общий Reset
 * - Добавить опциональные функции transform и normalize
 */

export const createTextInput = ({
  name,
  schema,
  formPrefix = "",
  persist = false,
}: CreateTextInput) => {
  const $ref = createStore<Nullable<HTMLInputElement>>(null);
  const $value = createStore<string>("");
  const $error = createStore<Nullable<Yup.ValidationError>>(null);
  const $errorMessage = $error.map((err) => (err ? err.message : ""));
  const $isRequiredError = $error.map((err) =>
    err ? err.type === "required" : false
  );
  const $isTouched = createStore<boolean>(false);
  const $isDirty = createStore<boolean>(false);
  const $isValid = $error.map((err) => err === null);
  const $isPersist = createStore<boolean>(persist);

  const _setRef = createEvent<Nullable<HTMLInputElement>>();
  const _clearRef = createEvent();
  $ref.on(_setRef, (_, ref) => ref).reset(_clearRef);

  const _setValue = createEvent<string>();
  const _clearValue = createEvent();
  $value.on(_setValue, (_, v) => v).reset(_clearValue);

  const _setIsDirty = createEvent();
  const _clearIsDirty = createEvent();
  $isDirty.on(_setIsDirty, () => true).reset(_clearIsDirty);

  const _setIsTouched = createEvent();
  const _clearIsTouched = createEvent();
  $isTouched.on(_setIsTouched, () => true).reset(_clearIsTouched);

  const validateFx = createEffect<string, string, Yup.ValidationError>(
    async (value) => {
      if (schema) {
        const parsedValue = (await schema.validate(value)) as
          | Promise<string>
          | string;
        return parsedValue;
      }
      return value;
    }
  );
  const _clearError = createEvent();
  const validate = createEvent();

  $error
    .on(validateFx.failData, (_, err) => err)
    .reset([validateFx.done, _clearError]);

  sample({
    clock: validate,
    source: $value,
    target: validateFx,
  });

  guard({
    source: $ref,
    filter: (ref): ref is HTMLInputElement => ref instanceof HTMLInputElement,
    target: createEffect<HTMLInputElement, void>((ref) =>
      ref.setAttribute("name", name)
    ),
  });

  const loadValueFromStorageFx = createEffect<void, string>(() => {
    return JSON.parse(
      window.localStorage.getItem(`${formPrefix}_${name}`) ?? ""
    );
  });

  const saveValueToStorageFx = createEffect<string, void>((value) => {
    window.localStorage.setItem(`${formPrefix}_${name}`, JSON.stringify(value));
  });

  guard({
    source: [$ref, $isPersist],
    filter: ([ref, isPersist]) => ref !== null && isPersist,
    target: loadValueFromStorageFx,
  });

  $value.on(loadValueFromStorageFx.doneData, (_, v) => v);

  sample({
    clock: loadValueFromStorageFx.doneData,
    source: $ref as Store<HTMLInputElement>,
    fn: (ref, value) => ({ ref, value }),
    target: createEffect<{ ref: HTMLInputElement; value: string }, void>(
      ({ ref, value }) => {
        ref.value = value;
      }
    ),
  });

  sample({
    clock: guard({
      clock: _setValue,
      filter: $isPersist,
    }),
    source: $value,
    target: saveValueToStorageFx,
  });

  const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    evt.preventDefault();
    _setValue(evt.target.value);
    _setIsDirty();
  };

  const setRef = (el: Nullable<HTMLInputElement>) => _setRef(el);

  // debug
  // $value.watch((v) => console.log({ v }));
  // $isPersist.watch((persist) => console.log({ persist }));
  // $error.watch((err) => console.log({ err }));

  return {
    onChange,
    setRef,
    validate,
    error: $error,
    isValid: $isValid,
    isRequiredError: $isRequiredError,
  };
};

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

const App: React.FC = () => {
  const handleSubmit = (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    submit();
  };

  return (
    <div>
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
    </div>
  );
};

export { App };
