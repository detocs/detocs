import { User } from "../../models/twitter";

export default interface ClientState {
  loggedIn: boolean;
  authorizeUrl: string;
  user: User | null;
  screenshot: string | null;
}


export const nullState: ClientState = Object.freeze({
  loggedIn: false,
  authorizeUrl: '#',
  user: null,
  screenshot: null,
});
