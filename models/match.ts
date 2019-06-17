export default interface Match {
  id: string;
  name: string;
  smashggId: string | null;
}

export const nullMatch: Match = {
  id: '',
  name: '',
  smashggId: null,
};
