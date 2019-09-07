import { User } from "../../models/twitter";

export default interface ClientState {
  loggedIn: boolean;
  authorizeUrl: string | null;
  user: User | null;
}
