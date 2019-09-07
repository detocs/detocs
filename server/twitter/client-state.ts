import { User } from "../../models/twitter";

export default interface ClientState {
  loggedIn: boolean;
  authorizeUrl: string;
  user: User | null;
}


export const nullState: ClientState = Object.freeze({
  loggedIn: false,
  authorizeUrl: '#',
  user: null,
});
