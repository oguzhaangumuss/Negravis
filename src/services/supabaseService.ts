import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || 'https://oyxquuokmedbqkmsjlyy.supabase.co'
// Use service role key to bypass RLS for hackathon development
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95eHF1dW9rbWVkYnFrbXNqbHl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTgzNTkwNCwiZXhwIjoyMDQxNDExOTA0fQ.vH9onhq6i1bpCc1Fn8YVJLdxcn0r4gNY7xG-Gu5oD2c'

console.log('🔧 Supabase Service initialized with service role key for hackathon development')
export const supabase = createClient(supabaseUrl, supabaseKey)

export interface QueryHistoryRecord {
  id?: string
  user_session_id: string
  query: string
  provider: string
  answer?: string
  oracle_used?: string
  oracle_info?: any
  data_sources?: any
  confidence?: number
  raw_data?: any
  blockchain_hash?: string
  blockchain_link?: string
  query_id?: string
  execution_time_ms?: number
  cost_tinybars?: number
  hcs_topic_id?: string // NEW: HCS Topic ID
  created_at?: string
  updated_at?: string
}

export class SupabaseService {
  /**
   * Save query history to database including HCS topic ID
   */
  async saveQueryHistory(data: QueryHistoryRecord): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      console.log('💾 Saving query history to Supabase:', {
        query_id: data.query_id,
        query: data.query,
        provider: data.provider,
        hcs_topic_id: data.hcs_topic_id // Log the topic ID
      })

      // For hackathon: simplified insert without RLS
      const insertData = {
        user_session_id: data.user_session_id,
        query: data.query,
        provider: data.provider,
        answer: data.answer || null,
        oracle_used: data.oracle_used || null,
        oracle_info: data.oracle_info || null,
        data_sources: data.data_sources || null,
        confidence: data.confidence || null,
        raw_data: data.raw_data || null,
        blockchain_hash: data.blockchain_hash || null,
        blockchain_link: data.blockchain_link || null,
        query_id: data.query_id || null,
        execution_time_ms: data.execution_time_ms || null,
        cost_tinybars: data.cost_tinybars || null,
        hcs_topic_id: data.hcs_topic_id || null
      }

      console.log('🔧 Attempting to insert with service role key...')
      const { data: result, error } = await supabase
        .from('query_history')
        .insert([insertData])
        .select('id')
        .single()

      if (error) {
        console.error('❌ Supabase insert error:', error)
        console.error('❌ Full error details:', JSON.stringify(error, null, 2))
        return { success: false, error: error.message }
      }

      console.log('✅ Query history saved with ID:', result.id)
      return { success: true, id: result.id }
    } catch (error) {
      console.error('❌ Supabase service error:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get active HCS topic IDs from database
   */
  async getActiveTopicIds(hoursBack: number = 24): Promise<string[]> {
    try {
      console.log(`🔍 Getting active topic IDs from last ${hoursBack} hours`)

      const { data, error } = await supabase
        .from('query_history')
        .select('hcs_topic_id')
        .not('hcs_topic_id', 'is', null)
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Failed to get active topic IDs:', error)
        return []
      }

      const uniqueTopicIds = [...new Set(
        data
          .map(record => record.hcs_topic_id)
          .filter(topicId => topicId && topicId.match(/^0\.0\.\d+$/))
      )] as string[]

      console.log(`✅ Found ${uniqueTopicIds.length} active topic IDs:`, uniqueTopicIds)
      return uniqueTopicIds
    } catch (error) {
      console.error('❌ Error getting active topic IDs:', error)
      return []
    }
  }

  /**
   * Get recent query history from database
   */
  async getRecentQueries(limit: number = 20): Promise<QueryHistoryRecord[]> {
    try {
      const { data, error } = await supabase
        .from('query_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('❌ Failed to get recent queries:', error)
        return []
      }

      console.log(`✅ Retrieved ${data.length} recent queries from database`)
      return data
    } catch (error) {
      console.error('❌ Error getting recent queries:', error)
      return []
    }
  }

  /**
   * Update query with HCS response data
   */
  async updateQueryWithHCSData(queryId: string, hcsData: {
    hcs_topic_id: string
    blockchain_hash: string
    blockchain_link: string
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('query_history')
        .update({
          hcs_topic_id: hcsData.hcs_topic_id,
          blockchain_hash: hcsData.blockchain_hash,
          blockchain_link: hcsData.blockchain_link,
          updated_at: new Date().toISOString()
        })
        .eq('query_id', queryId)

      if (error) {
        console.error('❌ Failed to update query with HCS data:', error)
        return false
      }

      console.log('✅ Updated query with HCS data:', queryId)
      return true
    } catch (error) {
      console.error('❌ Error updating query with HCS data:', error)
      return false
    }
  }
}

export const supabaseService = new SupabaseService()