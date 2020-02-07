import { User } from "../../models/twitter";
import { MediaFile } from "../media/server";

export default interface ClientState {
  loggedIn: boolean;
  authorizeUrl: string;
  user: User | null;
  screenshot: MediaFile | null;
}


export const nullState: ClientState = Object.freeze({
  loggedIn: false,
  authorizeUrl: '#',
  user: null,
  screenshot: null,
});
