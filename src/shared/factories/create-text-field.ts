import {
  createStore,
  createEvent,
  createEffect,
  sample,
  guard,
} from "effector-root";
import type { Store, Event } from "effector-root";
import * as Yup from "yup";

export type Nullable<T> = T | null;

export type ValidationError = Partial<Yup.ValidationError>;

export type TextFieldParams = {
  name: string;
  schema?: Yup.StringSchema;
  formPrefix?: string;
  persist?: boolean;
  transform?: (value: string) => string;
  normalize?: (value: string) => string;
};

export type TextFieldModel = {
  value: Store<string>;
  field: Store<{
    key: string;
    value: string;
  }>;
  isTouched: Store<boolean>;
  isDirty: Store<boolean>;
  error: Store<Nullable<Partial<Yup.ValidationError>>>;
  errorMessage: Store<string>;
  isValid: Store<boolean>;
  isRequiredError: Store<boolean>;
  isValidating: Store<boolean>;
  validate: Event<void>;
  reset: Event<void>;
  setValue: Event<string>;
  setError: Event<Nullable<Partial<Yup.ValidationError>>>;
  focus: Event<void>;
  onChange: (evt: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (evt: React.FocusEvent<HTMLInputElement>) => void;
  setRef: (el: Nullable<HTMLInputElement>) => Nullable<HTMLInputElement>;
  name: string;
};

export type CreateTextField = (params: TextFieldParams) => TextFieldModel;

export const createTextField: CreateTextField = ({
  name,
  schema,
  formPrefix = "",
  persist = false,
  transform = (v) => v,
  normalize = (v) => v,
}) => {
  // Stores
  const $ref = createStore<Nullable<HTMLInputElement>>(null);
  const $value = createStore<string>("");
  const $error = createStore<Nullable<ValidationError>>(null);
  const $isTouched = createStore<boolean>(false);
  const $isDirty = createStore<boolean>(false);
  const $isPersist = createStore<boolean>(persist);

  // Mapped Stores
  const $field = $value.map((value) => ({
    key: name,
    value: normalize(value),
  }));
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

  // Run validation
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

  return {
    // Stores
    value: $value,
    field: $field,
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
