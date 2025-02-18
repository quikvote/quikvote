const calculateVoteResult = (votes: any) => {
  const totals = new Map()
  votes.forEach((element: any) => {
    Object.keys(element.votes).forEach(key => {
      totals.set(key, (totals.get(key) ?? 0) + element.votes[key])
    })
  });
  const sortedOptions = Array.from(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
  return sortedOptions
}

export default calculateVoteResult;