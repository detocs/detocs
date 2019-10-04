export default interface Match {
  readonly id: string;
  readonly name: string;
  readonly smashggId: string | null;
}

export const nullMatch: Match = {
  id: '',
  name: '',
  smashggId: null,
};
