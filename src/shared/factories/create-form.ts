import { createEvent, sample, combine } from "effector-root";
import type { Event } from "effector-root";
import { every } from "patronum/every";
import { some } from "patronum/some";
import { combineEvents } from "patronum/combine-events";
import { TextFieldModel } from "./create-text-field";

export type CreateFormParams = {
  fields: TextFieldModel[];
};

/**
 * TODO
 * При submit провалидировать все поля и добавить функцию для отправки данных,
 * при условии что форма изменена
 */

export const createForm = ({ fields }: CreateFormParams) => {
  const submit = createEvent();

  const $isValid = every({
    predicate: true,
    stores: fields.map((field) => field.isValid),
  });

  const $isTouched = some({
    predicate: true,
    stores: fields.map((field) => field.isTouched),
  });

  const $isDirty = some({
    predicate: true,
    stores: fields.map((field) => field.isDirty),
  });

  const $isValidating = some({
    predicate: true,
    stores: fields.map((field) => field.isValidating),
  });

  const validateAll = fields.map((field) => field.validate) as [
    Event<void>,
    ...Event<void>[]
  ];

  sample({
    clock: submit,
    target: validateAll,
  });

  const runValidate = combineEvents({
    events: validateAll,
  });

  runValidate.watch(() => console.log("all validators runs"));

  const $data = combine(
    fields.map((item) => item.field),
    (kv) =>
      kv.reduce<Record<string, any>>(
        (acc, cur) => ({ ...acc, [cur.key]: cur.value }),
        {}
      )
  );

  // Debug
  $isValid.watch((v) => console.log("isValid:", v));
  $data.watch((values) => console.log({ values }));

  return {
    submit,
    data: $data,
    isTouched: $isTouched,
    isDirty: $isDirty,
    isValidating: $isValidating,
  };
};
