import { OracleProviderBase } from '../OracleProviderBase';
import { OracleQueryOptions, OracleError } from '../../../types/oracle';

/**
 * Sports Oracle Adapter
 * Provides comprehensive sports data from multiple sources
 * Primary: balldontlie (NBA) + TheSportsDB (Multi-sport)
 */
export class SportsOracleAdapter extends OracleProviderBase {
  public readonly name = 'sports';
  public readonly weight = 0.87;
  public readonly reliability = 0.92;
  public readonly latency = 800;

  // Free APIs - no authentication required (TheSportsDB primary)
  private readonly sportsDbEndpoint = 'https://www.thesportsdb.com/api/v1/json/3';
  private readonly sportsDbSearchEndpoint = 'https://www.thesportsdb.com/api/v1/json/3';
  private readonly ballDontLieEndpoint = 'https://api.balldontlie.io/v1'; // Added missing property

  protected async fetchData(query: string, options?: OracleQueryOptions): Promise<any> {
    console.log(`🏀 Sports fetchData called with query: "${query}"`);
    
    const queryType = this.determineSportsQueryType(query);
    console.log(`🎯 Sports query type: "${queryType}"`);

    try {
      switch (queryType) {
        case 'team':
          return await this.fetchTeamData(query);
        case 'player':
          return await this.fetchPlayerData(query);
        case 'league':
          return await this.fetchLeagueData(query);
        case 'nba':
        case 'schedule':
        default:
          return await this.fetchGeneralSports(query);
      }
    } catch (error: any) {
      console.error(`❌ Sports fetch error:`, error);
      
      if (error instanceof OracleError) {
        throw error;
      }
      
      throw new OracleError(
        `Failed to fetch sports data: ${error.message}`,
        'FETCH_ERROR',
        this.name,
        query
      );
    }
  }

  /**
   * Fetch NBA data from TheSportsDB (fallback since balldontlie is down)
   */
  private async fetchNBAData(query: string): Promise<any> {
    const searchTerm = this.extractSearchTerm(query);
    console.log(`🏀 NBA query redirected to TheSportsDB: "${searchTerm}"`);
    
    // Since balldontlie is down, use TheSportsDB for NBA data
    return await this.fetchGeneralSports(`NBA ${searchTerm}`);
  }

  /**
   * Fetch NBA player data
   */
  private async fetchNBAPlayer(playerName: string): Promise<any> {
    // TheSportsDB player search instead of balldontlie
    const url = `${this.sportsDbEndpoint}/searchplayers.php?p=${encodeURIComponent(playerName)}`;
    
    console.log(`🏀 Fetching NBA player via TheSportsDB: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Negravis-Oracle/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `NBA Player API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        playerName
      );
    }

    const data: any = await response.json();
    console.log(`🏀 NBA player response:`, data);

    if (!data.player || data.player.length === 0) {
      throw new OracleError(
        `No NBA player found for: ${playerName}`,
        'NO_DATA',
        this.name,
        playerName
      );
    }

    const player = data.player[0];

    return {
      type: 'nba_player',
      player_name: player.strPlayer,
      position: player.strPosition,
      team: player.strTeam,
      sport: player.strSport,
      nationality: player.strNationality,
      birth_date: player.dateBorn,
      height: player.strHeight,
      weight: player.strWeight,
      description: player.strDescriptionEN,
      source: 'thesportsdb',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch NBA team data
   */
  private async fetchNBATeam(teamName: string): Promise<any> {
    const url = `${this.sportsDbEndpoint}/searchteams.php?t=${encodeURIComponent(teamName)}`;
    
    console.log(`🏀 Fetching NBA teams via TheSportsDB: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Negravis-Oracle/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `NBA Teams API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        teamName
      );
    }

    const data: any = await response.json();
    
    if (!data.teams || data.teams.length === 0) {
      throw new OracleError(
        `No NBA team found for: ${teamName}`,
        'NO_DATA',
        this.name,
        teamName
      );
    }

    const team = data.teams[0];

    return {
      type: 'nba_team',
      team_name: team.strTeam,
      sport: team.strSport,
      league: team.strLeague,
      country: team.strCountry,
      founded: team.intFormedYear,
      stadium: team.strStadium,
      description: team.strDescriptionEN,
      website: team.strWebsite,
      logo: team.strTeamLogo,
      source: 'thesportsdb',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch NBA games
   */
  private async fetchNBAGames(query: string): Promise<any> {
    // Use TheSportsDB for NBA schedule/events
    const url = `${this.sportsDbEndpoint}/eventsnext.php?id=4387`; // NBA league ID
    
    console.log(`🏀 Fetching NBA games via TheSportsDB: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Negravis-Oracle/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `NBA Games API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        query
      );
    }

    const data: any = await response.json();
    
    if (!data.events || data.events.length === 0) {
      // Return fallback schedule info
      return {
        type: 'nba_schedule',
        message: 'NBA schedule data not available at this time',
        info: 'Visit NBA.com for latest games and schedules',
        source: 'thesportsdb_fallback',
        last_updated: new Date().toISOString()
      };
    }
    
    const games = data.events.slice(0, 10).map((game: any) => ({
      event_id: game.idEvent,
      date: game.dateEvent,
      time: game.strTime,
      home_team: game.strHomeTeam,
      away_team: game.strAwayTeam,
      league: game.strLeague,
      season: game.strSeason,
      venue: game.strVenue
    }));

    return {
      type: 'nba_games',
      games_count: games.length,
      upcoming_games: games,
      source: 'thesportsdb',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch general sports data from TheSportsDB
   */
  private async fetchGeneralSports(query: string): Promise<any> {
    // Search for leagues first
    const searchTerm = this.extractSearchTerm(query);
    const url = `${this.sportsDbEndpoint}/search_all_leagues.php?s=${encodeURIComponent(searchTerm)}`;
    
    console.log(`⚽ Fetching general sports: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Negravis-Oracle/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `TheSportsDB API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        query
      );
    }

    const data: any = await response.json();
    
    if (!data.leagues || data.leagues.length === 0) {
      throw new OracleError(
        `No sports leagues found for query: ${searchTerm}`,
        'NO_DATA',
        this.name,
        query
      );
    }

    const leagues = data.leagues.slice(0, 5).map((league: any) => ({
      league_id: league.idLeague,
      league_name: league.strLeague,
      sport: league.strSport,
      country: league.strCountry,
      description: league.strDescriptionEN,
      website: league.strWebsite,
      logo: league.strLogo
    }));

    return {
      type: 'sports_leagues',
      query: searchTerm,
      leagues_found: leagues.length,
      leagues: leagues,
      source: 'thesportsdb',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Determine sports query type
   */
  private determineSportsQueryType(query: string): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('nba') || lowerQuery.includes('basketball')) {
      return 'nba';
    }
    
    // Check for team names first before generic keywords
    if (this.isTeamQuery(query)) {
      return 'team';
    }
    
    if (lowerQuery.includes('team') || lowerQuery.includes('teams')) {
      return 'team';
    }
    
    if (this.isPlayerQuery(query)) {
      return 'player';
    }
    
    if (lowerQuery.includes('player') || lowerQuery.includes('players')) {
      return 'player';
    }
    
    if (lowerQuery.includes('league') || lowerQuery.includes('leagues')) {
      return 'league';
    }
    
    if (lowerQuery.includes('game') || lowerQuery.includes('games') || 
        lowerQuery.includes('schedule') || lowerQuery.includes('fixture')) {
      return 'schedule';
    }

    return 'general';
  }

  /**
   * Check if query is asking for player information
   */
  private isPlayerQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const playerKeywords = ['player', 'stats', 'points', 'assists', 'rebounds'];
    return playerKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Check if query is asking for team information
   */
  private isTeamQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const teamKeywords = ['team', 'roster', 'conference', 'division'];
    
    // Common player names to exclude
    const playerNames = [
      'lebron', 'james', 'curry', 'stephen', 'kobe', 'bryant', 'jordan', 'michael',
      'durant', 'kevin', 'giannis', 'antetokounmpo', 'kawhi', 'leonard'
    ];
    
    // If it contains player names, it's likely a player query
    if (playerNames.some(name => lowerQuery.includes(name))) {
      return false;
    }
    
    const nbaTeams = [
      'lakers', 'warriors', 'celtics', 'bulls', 'knicks', 'heat', 'spurs',
      'rockets', 'clippers', 'nuggets', 'suns', 'mavericks', 'nets', 'sixers',
      'bucks', 'raptors', 'thunder', 'trail blazers', 'jazz', 'kings',
      'magic', 'hornets', 'pistons', 'cavaliers', 'hawks', 'wizards',
      'pacers', 'grizzlies', 'pelicans', 'timberwolves'
    ];
    const soccerTeams = [
      'manchester united', 'chelsea', 'arsenal', 'liverpool', 'barcelona', 
      'real madrid', 'bayern munich', 'juventus', 'psg', 'milan'
    ];
    
    return teamKeywords.some(keyword => lowerQuery.includes(keyword)) ||
           nbaTeams.some(team => lowerQuery.includes(team)) ||
           soccerTeams.some(team => lowerQuery.includes(team));
  }

  /**
   * Extract search term from query
   */
  private extractSearchTerm(query: string): string {
    // Simply return the original query for sports searches
    // Cleaning causes issues with team names like "Los Angeles Lakers"
    return query.trim();
  }

  /**
   * Generate demo sports data for fallback
   */
  private generateDemoSportsData(query: string): any {
    const demoLeagues = [
      {
        league_name: 'National Basketball Association',
        sport: 'Basketball',
        country: 'USA',
        teams: 30,
        season: '2024-25'
      },
      {
        league_name: 'Premier League',
        sport: 'Soccer',
        country: 'England',
        teams: 20,
        season: '2024-25'
      },
      {
        league_name: 'National Football League',
        sport: 'American Football',
        country: 'USA',
        teams: 32,
        season: '2024'
      }
    ];

    return {
      type: 'sports_demo',
      query: query,
      demo_leagues: demoLeagues,
      source: 'sports_demo_fallback',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch team data from TheSportsDB
   */
  private async fetchTeamData(query: string): Promise<any> {
    const searchTerm = this.extractSearchTerm(query);
    
    // Try with full team name first if it's a short name
    const fullTeamName = this.expandTeamName(searchTerm);
    const url = `${this.sportsDbEndpoint}/searchteams.php?t=${encodeURIComponent(fullTeamName)}`;
    
    console.log(`⚽ Fetching team data: ${url} (expanded: ${searchTerm} → ${fullTeamName})`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Negravis-Oracle/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `Team search API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        query
      );
    }

    const data: any = await response.json();
    
    if (!data.teams || data.teams.length === 0) {
      throw new OracleError(
        `No teams found for: ${fullTeamName}`,
        'NO_DATA',
        this.name,
        query
      );
    }

    const team = data.teams[0];

    return {
      type: 'sports_team',
      team_name: team.strTeam,
      sport: team.strSport,
      league: team.strLeague,
      country: team.strCountry,
      founded: team.intFormedYear,
      stadium: team.strStadium,
      description: team.strDescriptionEN,
      website: team.strWebsite,
      logo: team.strTeamLogo,
      jersey: team.strTeamJersey,
      source: 'thesportsdb',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch player data from TheSportsDB
   */
  private async fetchPlayerData(query: string): Promise<any> {
    const searchTerm = this.extractSearchTerm(query);
    
    // Try NBA first for basketball players
    if (this.isBasketballQuery(query)) {
      try {
        return await this.fetchNBAPlayer(searchTerm);
      } catch (error) {
        console.log(`🏀 NBA player search failed, trying TheSportsDB:`, error);
      }
    }

    const url = `${this.sportsDbEndpoint}/searchplayers.php?p=${encodeURIComponent(searchTerm)}`;
    
    console.log(`⚽ Fetching player data: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Negravis-Oracle/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new OracleError(
        `Player search API error: ${response.status} ${response.statusText}`,
        'API_ERROR',
        this.name,
        query
      );
    }

    const data: any = await response.json();
    
    if (!data.player || data.player.length === 0) {
      throw new OracleError(
        `No players found for: ${searchTerm}`,
        'NO_DATA',
        this.name,
        query
      );
    }

    const player = data.player[0];

    return {
      type: 'sports_player',
      player_name: player.strPlayer,
      sport: player.strSport,
      team: player.strTeam,
      nationality: player.strNationality,
      position: player.strPosition,
      birth_date: player.dateBorn,
      height: player.strHeight,
      weight: player.strWeight,
      description: player.strDescriptionEN,
      photo: player.strCutout,
      source: 'thesportsdb',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Fetch league data from TheSportsDB
   */
  private async fetchLeagueData(query: string): Promise<any> {
    return await this.fetchGeneralSports(query);
  }

  /**
   * Fetch schedule data
   */
  private async fetchScheduleData(query: string): Promise<any> {
    // For NBA, use games endpoint
    if (this.isBasketballQuery(query)) {
      return await this.fetchNBAGames(query);
    }

    // For other sports, return demo schedule
    return {
      type: 'sports_schedule',
      message: 'Schedule data available for NBA games. For other sports, please specify the league.',
      available_leagues: ['NBA', 'Premier League', 'NFL', 'MLB'],
      source: 'sports_schedule_info',
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Check if query is related to basketball
   */
  private isBasketballQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return lowerQuery.includes('nba') || lowerQuery.includes('basketball');
  }

  /**
   * Expand short team names to full names
   */
  private expandTeamName(teamName: string): string {
    const lowerName = teamName.toLowerCase().trim();
    
    const teamExpansions: Record<string, string> = {
      'lakers': 'Los Angeles Lakers',
      'warriors': 'Golden State Warriors', 
      'celtics': 'Boston Celtics',
      'bulls': 'Chicago Bulls',
      'knicks': 'New York Knicks',
      'heat': 'Miami Heat',
      'spurs': 'San Antonio Spurs',
      'rockets': 'Houston Rockets',
      'clippers': 'Los Angeles Clippers',
      'nuggets': 'Denver Nuggets',
      'suns': 'Phoenix Suns',
      'mavericks': 'Dallas Mavericks',
      'mavs': 'Dallas Mavericks',
      'nets': 'Brooklyn Nets',
      'sixers': 'Philadelphia 76ers',
      '76ers': 'Philadelphia 76ers',
      'bucks': 'Milwaukee Bucks',
      'raptors': 'Toronto Raptors',
      'thunder': 'Oklahoma City Thunder',
      'jazz': 'Utah Jazz',
      'kings': 'Sacramento Kings',
      'magic': 'Orlando Magic',
      'hornets': 'Charlotte Hornets',
      'pistons': 'Detroit Pistons',
      'cavaliers': 'Cleveland Cavaliers',
      'cavs': 'Cleveland Cavaliers',
      'hawks': 'Atlanta Hawks',
      'wizards': 'Washington Wizards',
      'pacers': 'Indiana Pacers',
      'grizzlies': 'Memphis Grizzlies',
      'pelicans': 'New Orleans Pelicans',
      'timberwolves': 'Minnesota Timberwolves',
      'wolves': 'Minnesota Timberwolves'
    };
    
    return teamExpansions[lowerName] || teamName;
  }

  /**
   * Check if team name is NBA team
   */
  private isNBATeam(teamName: string): boolean {
    const nbaTeams = [
      'lakers', 'warriors', 'celtics', 'bulls', 'knicks', 'heat', 'spurs',
      'rockets', 'clippers', 'nuggets', 'suns', 'mavericks', 'nets', 'sixers'
    ];
    
    return nbaTeams.some(team => teamName.toLowerCase().includes(team));
  }

  /**
   * Health check implementation
   */
  protected async performHealthCheck(): Promise<void> {
    // Test TheSportsDB API
    const sportsDbUrl = `${this.sportsDbEndpoint}/all_leagues.php`;
    
    const sportsDbResponse = await fetch(sportsDbUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Negravis-Oracle/2.0'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!sportsDbResponse.ok) {
      throw new Error(`TheSportsDB API health check failed: ${sportsDbResponse.status}`);
    }

    const data: any = await sportsDbResponse.json();
    if (!data || !data.leagues) {
      throw new Error('TheSportsDB API returned invalid data structure');
    }
  }

  /**
   * Enhanced confidence calculation for sports data
   */
  protected calculateConfidence(data: any): number {
    if (!data) return 0;

    let confidence = 0.92; // Base confidence for sports data

    // Adjust based on data type
    if (data.type === 'nba_player' || data.type === 'nba_team' || data.type === 'nba_games') {
      confidence += 0.05; // NBA data is very reliable
    }

    // Adjust based on data completeness
    if (data.player_name || data.team_name) confidence += 0.02;
    if (data.description && data.description.length > 100) confidence += 0.01;
    
    // Penalize demo/fallback data
    if (data.type === 'sports_demo' || data.source.includes('demo')) {
      confidence -= 0.15;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'Sports Oracle',
      version: 'v1.0',
      description: 'Comprehensive sports data from NBA and global leagues',
      endpoints: [
        'NBA Players & Stats',
        'NBA Teams & Info', 
        'NBA Games & Scores',
        'Global Sports Leagues',
        'Team Information',
        'Player Profiles'
      ],
      features: [
        'Real-time NBA data',
        'Global sports coverage',
        'Player statistics', 
        'Team information',
        'Game schedules',
        'League data'
      ],
      dataTypes: [
        'Player stats & profiles',
        'Team information',
        'Game scores & schedules',
        'League standings',
        'Sports news',
        'Historical data'
      ],
      dataSources: [
        'balldontlie (NBA)',
        'TheSportsDB (Multi-sport)'
      ],
      rateLimit: 'No rate limits (free APIs)',
      coverage: 'NBA + Global sports leagues'
    };
  }

  /**
   * Get provider metrics
   */
  async getMetrics(): Promise<any> {
    const baseMetrics = await super.getMetrics();
    const isHealthy = await this.healthCheck();
    
    return {
      ...baseMetrics,
      provider: this.name,
      healthy: isHealthy,
      data_tier: 'free_comprehensive',
      api_endpoints: 6,
      coverage: 'nba_plus_global',
      update_frequency: 'real_time',
      rate_limit: 'no_limits',
      sports_covered: 'basketball_soccer_football_baseball',
      leagues_count: '50+',
      last_check: new Date().toISOString()
    };
  }

  /**
   * Get supported symbols (sports doesn't use symbols, return empty)
   */
  getSupportedSymbols(): string[] {
    return [];
  }
}