import { Result, Room } from ".";

/*
  * HOW TO ADD A VOTE TYPE (backend)
  *
  * 1. Add a type to the VoteType enum (eg. Rank = 'rank')
  * 2. Add a mod options interface that extends BaseModOptions
  * 3. Add the vote type to the VoteConfig type with the options
  * 4. Add the vote type to the Vote type with the shape that a single user's vote should take
  * 5. Add an aggregation function to compile several user's votes into a Result object
  * 6. Ensure that the frontend is updated to handle the new vote type (see src/pages/vote/voteTypes/render.jsx)
  *
  */

export interface VoterInfo {
  username: string
  votes: number
}

export interface ItemResult {
  name: string
  votes: number
  voters: VoterInfo[]
}

export type UserVoteResult = Map<string, ItemResult>

export enum VoteType {
  Score = 'score',
  Rank = 'rank',
  TopChoices = 'topChoices',
  Approval = 'approval',
  Quadratic = 'quadratic'
}

export enum ResultDisplayType {
  Bar = 'bar',
  Pie = 'pie',
  Podium = 'podium'
}

// Vote options

export interface BaseModOptions { // options that apply to all vote types (eg. results options)
  numRunnerUps: number
  showNumVotes: boolean
  showWhoVoted: boolean
  allowNewOptions: boolean
  resultDisplayType: ResultDisplayType  // Type of result display (bar, pie, podium)

  // Multi-round voting options
  enableRound?: boolean        // Whether to enable multi-round voting
  eliminationCount?: number    // How many options to eliminate each round
  maxRounds?: number           // Maximum number of rounds
  autoAdvance?: boolean        // Whether to automatically advance to next round
}
export interface ScoreModOptions extends BaseModOptions {
  minVotesPerOption: number
  maxVotesPerOption: number
}

export interface RankModOptions extends BaseModOptions { }

export interface TopChoicesModOptions extends BaseModOptions {
  numberOfChoices: number
}

export interface ApprovalModOptions extends BaseModOptions { }

export interface QuadraticModOptions extends BaseModOptions {
  creditBudget: number
}

// Vote config

export type VoteConfig =
    | { type: VoteType.Score; options: ScoreModOptions }
    | { type: VoteType.Rank; options: RankModOptions }
    | { type: VoteType.TopChoices; options: TopChoicesModOptions }
    | { type: VoteType.Approval; options: ApprovalModOptions }
    | { type: VoteType.Quadratic; options: QuadraticModOptions }

export type Vote =
    | { type: VoteType.Score; scores: Record<string, number> }
    | { type: VoteType.Rank; rankings: Record<string, number> }
    | { type: VoteType.TopChoices; topChoices: Record<string, string | null> }
    | { type: VoteType.Approval; approvals: Record<string, boolean> }
    | { type: VoteType.Quadratic; votes: Record<string, number>, costs: Record<string, number> }


// Aggregation Functions

export const aggregationMap: Record<VoteType, (room: Room) => Result> = {
  [VoteType.Score]: aggregateScoreVote,
  [VoteType.Rank]: aggregateRankVote,
  [VoteType.TopChoices]: aggregateTopChoicesVote,
  [VoteType.Approval]: aggregateApprovalVote,
  [VoteType.Quadratic]: aggregateQuadraticVote
}

export function aggregateScoreVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Score) {
    throw new Error('Vote type must be "score"')
  }

  const results = new Map<string, ItemResult>();
  
  // Process each option
  room.options.forEach(option => {
    // Initialize each option with zero votes
    results.set(option, {
      name: option,
      votes: 0,
      voters: []
    });
  });

  // Process each user's votes
  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Score) {
      const vote = userVote.vote;
      
      // Process votes for each option
      Object.entries(vote.scores).forEach(([option, score]) => {
        // Make sure the option exists in our results
        if (!results.has(option)) {
          results.set(option, {
            name: option,
            votes: 0,
            voters: []
          });
        }
        
        const optionResult = results.get(option)!;
        
        // Add user's vote to total
        optionResult.votes += score;
        
        // Record user vote information if score is positive
        if (score > 0) {
          optionResult.voters.push({
            username: userVote.username,
            votes: score
          });
        }
      });
    }
  });

  // Process and sort the results
  const options = processResults(results, room);

  return {
    owner: room.owner,
    options: options,
    timestamp: Date.now()
  };
}

export function aggregateApprovalVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Approval) {
    throw new Error('Vote type must be "approval"')
  }

  const results = new Map<string, ItemResult>();
  
  // Initialize each option with zero votes
  room.options.forEach(option => {
    results.set(option, {
      name: option,
      votes: 0,
      voters: []
    });
  });

  // Process each user's approval votes
  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Approval) {
      const vote = userVote.vote;
      
      // Each approval counts as 1 point
      Object.entries(vote.approvals).forEach(([option, approved]) => {
        if (!results.has(option)) {
          results.set(option, {
            name: option,
            votes: 0,
            voters: []
          });
        }
        
        if (approved) {
          const optionResult = results.get(option)!;
          
          // Add 1 point to the option's total
          optionResult.votes += 1;
          
          // Record the user who approved
          optionResult.voters.push({
            username: userVote.username,
            votes: 1  // In approval voting, each approval is worth 1 vote
          });
        }
      });
    }
  });

  // Process and sort the results
  const options = processResults(results, room);

  return {
    owner: room.owner,
    options: options,
    timestamp: Date.now()
  };
}

export function aggregateQuadraticVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Quadratic) {
    throw new Error('Vote type must be "quadratic"')
  }

  const results = new Map<string, ItemResult>();
  
  // Initialize each option with zero votes
  room.options.forEach(option => {
    results.set(option, {
      name: option,
      votes: 0,
      voters: []
    });
  });

  // Process each user's quadratic votes
  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Quadratic) {
      const vote = userVote.vote;
      
      Object.entries(vote.votes).forEach(([option, voteCount]) => {
        if (!results.has(option)) {
          results.set(option, {
            name: option,
            votes: 0,
            voters: []
          });
        }
        
        const optionResult = results.get(option)!;
        
        // Add vote count to the option's total
        optionResult.votes += voteCount;
        
        // Record user vote information if vote count is positive
        if (voteCount > 0) {
          optionResult.voters.push({
            username: userVote.username,
            votes: voteCount
          });
        }
      });
    }
  });

  // Process and sort the results
  const options = processResults(results, room);

  return {
    owner: room.owner,
    options: options,
    timestamp: Date.now()
  };
}

export function aggregateRankVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Rank) {
    throw new Error('Vote type must be "rank"')
  }

  const results = new Map<string, ItemResult>();
  
  // Initialize each option with zero votes
  room.options.forEach(option => {
    results.set(option, {
      name: option,
      votes: 0,
      voters: []
    });
  });

  // Process each user's rank votes
  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Rank) {
      const vote = userVote.vote;
      const numOptions = room.options.length;
      
      Object.entries(vote.rankings).forEach(([option, rank]) => {
        if (!results.has(option)) {
          results.set(option, {
            name: option,
            votes: 0,
            voters: []
          });
        }
        
        const optionResult = results.get(option)!;
        
        // Invert the rank so first place (rank 1) gets the most points
        const points = numOptions - rank + 1;
        
        // Add points to the option's total
        optionResult.votes += points;
        
        // Record the user's ranking information with points instead of rank
        optionResult.voters.push({
          username: userVote.username,
          votes: points // Store the points (not rank) for display
        });
      });
    }
  });

  // Process and sort the results
  const options = processResults(results, room);

  return {
    owner: room.owner,
    options: options,
    timestamp: Date.now()
  };
}

export function aggregateTopChoicesVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.TopChoices) {
    throw new Error('Vote type must be "topChoices"')
  }

  const results = new Map<string, ItemResult>();
  
  // Initialize each option with zero votes
  room.options.forEach(option => {
    results.set(option, {
      name: option,
      votes: 0,
      voters: []
    });
  });

  // Process each user's top choices votes
  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.TopChoices) {
      const vote = userVote.vote;
      const numberOfChoices = Object.keys(vote.topChoices).length;
      
      // Process each choice position and its corresponding option
      Object.entries(vote.topChoices).forEach(([position, option]) => {
        // Skip null selections
        if (!option || !room.options.includes(option)) {
          return;
        }
        
        if (!results.has(option)) {
          results.set(option, {
            name: option,
            votes: 0,
            voters: []
          });
        }
        
        const optionResult = results.get(option)!;
        let points = 0;
        let rank = 0;
        
        // Calculate points based on position
        switch(position) {
          case 'first':
            points = numberOfChoices;
            rank = 1;
            break;
          case 'second':
            points = numberOfChoices - 1;
            rank = 2;
            break;
          case 'third':
            points = numberOfChoices - 2;
            rank = 3;
            break;
          default:
            // For positions beyond third, extract the number from the position name
            const choiceNum = parseInt(position.replace('choice', ''));
            if (!isNaN(choiceNum)) {
              points = numberOfChoices - (choiceNum - 1);
              rank = choiceNum;
            }
            break;
        }
        
        // Add points to the option's total
        optionResult.votes += points;
        
        // Record the user's choice information with points instead of rank
        optionResult.voters.push({
          username: userVote.username,
          votes: points // Store the points for display
        });
      });
    }
  });

  // Process and sort the results
  const options = processResults(results, room);

  return {
    owner: room.owner,
    options: options,
    timestamp: Date.now()
  };
}

/**
 * Process and sort the vote results
 * @param results Map of option names to their vote results
 * @param room Room data
 * @returns Sorted array of option results
 */
function processResults(results: UserVoteResult, room: Room): ItemResult[] {
  // Convert Map to array of ItemResults
  const optionResults: ItemResult[] = Array.from(results.entries()).map(([name, result]) => ({
    name,
    votes: result.votes,
    voters: result.voters.sort((a, b) => b.votes - a.votes) // Sort voters by vote count
  }));

  // Sort options by total votes (descending)
  optionResults.sort((a, b) => b.votes - a.votes);

  // If not showing who voted, clear the voters array
  if (!room.config.options.showWhoVoted) {
    optionResults.forEach(option => option.voters = []);
  }

  return optionResults;
}