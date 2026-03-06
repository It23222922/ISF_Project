import { createBrowserRouter } from "react-router";
import { HomeSelector } from "./components/HomeSelector";
import { Screen1Display } from "./components/Screen1Display";
import { Screen2Control } from "./components/Screen2Control";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: HomeSelector,
  },
  {
    path: "/screen1",
    Component: Screen1Display,
  },
  {
    path: "/screen2",
    Component: Screen2Control,
  },
]);
