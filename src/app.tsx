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
import { useStore } from "effector-react";

const schema = Yup.string()
  .test({
    test: (v) => (v ? v.length > 0 : false),
    name: "required",
    message: "Поле обязательное",
  })
  .min(5);

export type Nullable<T> = T | null;

export type ValidationError = Partial<Yup.ValidationError>;

type CreateTextInput = {
  name: string;
  schema?: Yup.StringSchema;
  formPrefix?: string;
  persist?: boolean;
  transform?: (value: string) => string;
  normalize?: (value: string) => string;
};

export const createTextInput = ({
  name,
  schema,
  formPrefix = "",
  persist = false,
  transform = (v) => v,
  normalize = (v) => v,
}: CreateTextInput) => {
  // Stores
  const $ref = createStore<Nullable<HTMLInputElement>>(null);
  const $value = createStore<string>("");
  const $error = createStore<Nullable<ValidationError>>(null);
  const $isTouched = createStore<boolean>(false);
  const $isDirty = createStore<boolean>(false);
  const $isPersist = createStore<boolean>(persist);

  // Mapped Stores
  const $normalizedValue = $value.map((value) => normalize(value));
  const $isValid = $error.map((err) => err === null);
  const $errorMessage = $error.map((err) => err?.message ?? "");
  const $isRequiredError = $error.map((err) => err?.type === "required");

  const _setRef = createEvent<Nullable<HTMLInputElement>>();
  const _clearRef = createEvent();
  $ref.on(_setRef, (_, ref) => ref).reset(_clearRef);

  const _setValue = createEvent<string>();
  const _clearValue = createEvent();
  $value.on(_setValue, (_, v) => transform(v)).reset(_clearValue);

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
  const setError = createEvent<Nullable<ValidationError>>();
  const _clearError = createEvent();
  const validate = createEvent();
  const $isValidating = validateFx.pending;

  $error
    .on(validateFx.failData, (_, err) => err)
    .on(setError, (_, err) => err)
    .reset([validateFx.done, _clearError]);

  // Start validation
  sample({
    clock: validate,
    source: $value,
    target: validateFx,
  });

  // Set Input name
  guard({
    source: $ref,
    filter: (ref): ref is HTMLInputElement => ref instanceof HTMLInputElement,
    target: createEffect<HTMLInputElement, void>((ref) =>
      ref.setAttribute("name", name)
    ),
  });

  // Persist methods
  const loadValueFromStorageFx = createEffect<void, string>(() => {
    return JSON.parse(
      window.localStorage.getItem(`${formPrefix}_${name}`) ?? ""
    );
  });

  const saveValueToStorageFx = createEffect<string, void>((value) => {
    window.localStorage.setItem(`${formPrefix}_${name}`, JSON.stringify(value));
  });

  // Load persist value on mount
  guard({
    source: [$ref, $isPersist],
    filter: ([ref, isPersist]) => ref !== null && isPersist,
    target: loadValueFromStorageFx,
  });

  $value.on(loadValueFromStorageFx.doneData, (_, v) => v);

  // Set input value on success load persist value
  sample({
    clock: loadValueFromStorageFx.doneData,
    source: $ref as Store<HTMLInputElement>,
    fn: (ref, value) => ({ ref, value }),
    target: createEffect<{ ref: HTMLInputElement; value: string }, void>(
      ({ ref, value }) => {
        ref.value = transform(value);
      }
    ),
  });

  // Sync value with persist storage
  sample({
    clock: guard({
      clock: _setValue,
      filter: $isPersist,
    }),
    source: $value,
    target: saveValueToStorageFx,
  });

  // Public handlers
  const onChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    evt.preventDefault();
    _setValue(evt.target.value);
    _setIsDirty();
  };

  const onBlur = (evt: React.FocusEvent<HTMLInputElement>) => {
    evt.preventDefault();
    _setIsTouched();
  };

  const setRef = (el: Nullable<HTMLInputElement>) => _setRef(el);

  // Common reset
  const reset = createEvent();

  sample({
    clock: reset,
    target: [_clearValue, _clearIsDirty, _clearIsTouched, _clearError],
  });

  // Imperative setValue
  const setValue = createEvent<string>();

  $value.on(setValue, (_, v) => transform(v));

  sample({
    clock: guard({
      clock: setValue,
      source: $ref,
      filter: (ref): ref is HTMLInputElement => ref instanceof HTMLInputElement,
    }),
    source: $value,
    fn: (value, ref) => ({ value, ref }),
    target: createEffect<{ value: string; ref: HTMLInputElement }, void>(
      ({ ref, value }) => {
        ref.value = normalize(value);
      }
    ),
  });

  // Focus on element
  const focus = createEvent();
  guard({
    clock: focus,
    source: $ref,
    filter: (ref): ref is HTMLInputElement => ref instanceof HTMLInputElement,
    target: createEffect<HTMLInputElement, void>((ref) => ref.focus()),
  });

  // debug
  // $value.watch((v) => console.log({ v }));
  // $isPersist.watch((persist) => console.log({ persist }));
  // $error.watch((err) => console.log({ err }));

  return {
    // Stores
    value: $value,
    normalizedValue: $normalizedValue,
    isTouched: $isTouched,
    isDirty: $isDirty,
    error: $error,
    errorMessage: $errorMessage,
    isValid: $isValid,
    isRequiredError: $isRequiredError,
    isValidating: $isValidating,
    // Events
    validate,
    reset,
    setValue,
    setError,
    focus,
    // Handlers
    onChange,
    onBlur,
    setRef,
    // Common
    name,
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
