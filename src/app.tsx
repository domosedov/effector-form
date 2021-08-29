import * as React from "react";
import {
  createStore,
  createEvent,
  createEffect,
  sample,
  guard,
} from "effector-root";
import type { Store } from "effector-root";
import { z, ZodError } from "zod";
import type { ZodString, ZodErrorMap } from "zod";
import { useStore } from "effector-react";

export function isZodError(value: unknown): value is ZodError {
  return value instanceof ZodError;
}

export type Nullable<T> = T | null;

const errorMap: ZodErrorMap = ({ code, path, message }) => {
  console.log({ code, path, message });
  return { message: "lol" };
};

type CreateTextInput = {
  name: string;
  schema?: ZodString;
  persist?: boolean;
};

export const createTextInput = ({
  name,
  schema,
  persist = false,
}: CreateTextInput) => {
  const $ref = createStore<Nullable<HTMLInputElement>>(null);
  const $value = createStore<string>("");
  const $error = createStore<Nullable<ZodError>>(null);
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

  const validateFx = createEffect<string, void, ZodError>(async (value) => {
    await schema?.parseAsync(value, {
      path: [name],
      errorMap,
    });
  });
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
    return JSON.parse(window.localStorage.getItem(name) ?? "");
  });

  const saveValueToStorageFx = createEffect<string, void>((value) => {
    window.localStorage.setItem(name, JSON.stringify(value));
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
  $value.watch((v) => console.log({ v }));
  $isPersist.watch((persist) => console.log({ persist }));

  return { onChange, setRef, validate, error: $error, isValid: $isValid };
};

const schema = z.string().min(1).min(10);

const { validate, setRef, onChange, error } = createTextInput({
  name: "email",
  schema,
  persist: true,
});

const App: React.FC = () => {
  const err = useStore(error);
  return (
    <div>
      <h1>Hello 12</h1>
      <pre>{err?.message}</pre>
      <input type="text" ref={(el) => setRef(el)} onChange={onChange} />
      <pre>{Math.random()}</pre>
      <button onClick={() => validate()}>Validate</button>
    </div>
  );
};

export { App };
