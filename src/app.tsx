import * as React from "react";
import * as Yup from "yup";
import { useStore } from "effector-react";
import { createTextField } from "./shared/factories/create-text-field";
import { createForm } from "./shared/factories/create-form";

const schema = Yup.string()
  .test({
    test: (v) => (v ? v.length > 0 : false),
    name: "required",
    message: "Поле обязательное",
  })
  .min(5);

const emailInput = createTextField({
  name: "email",
  formPrefix: "test",
  schema,
  persist: true,
});

const passInput = createTextField({
  name: "pass",
  formPrefix: "test",
  schema,
  persist: true,
});

const loginForm = createForm({
  fields: [emailInput, passInput],
});

const App: React.FC = () => {
  const handleSubmit = (evt: React.FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    loginForm.submit();
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
