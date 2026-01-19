import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CategorizeResult {
  category: string;
  event_date: string | null;
  event_identifier: string | null;
  promotion_end_date: string;
}

const VALID_CATEGORIES = [
  'EV_ALL', 'EV_FAM', 'EV_PAR', 'EV_SEN',
  'LU_ONS', 'LU_DEL',
  'PR_ONS_CYK', 'PR_ONS_JED', 'PR_DEL_CYK', 'PR_DEL_JED',
  'PD_ONS', 'PD_DEL',
  'BRAND', 'INFO',
];

const SYSTEM_PROMPT = `Jesteś ekspertem od kategoryzacji postów restauracji dla kampanii reklamowych.

Analizujesz post i wyciągasz:
1. category - jedna z kategorii:
   - EV_ALL (Wydarzenie dla wszystkich)
   - EV_FAM (Wydarzenie dla rodzin)
   - EV_PAR (Wydarzenie dla par)
   - EV_SEN (Wydarzenie dla seniorów)
   - LU_ONS (Lunch na miejscu)
   - LU_DEL (Lunch delivery)
   - PR_ONS_CYK (Promocja cykliczna na miejscu, np. "każdy wtorek")
   - PR_ONS_JED (Promocja jednorazowa na miejscu)
   - PR_DEL_CYK (Promocja cykliczna delivery)
   - PR_DEL_JED (Promocja jednorazowa delivery)
   - PD_ONS (Produkt na miejscu - danie, drink)
   - PD_DEL (Produkt delivery)
   - BRAND (Post brandowy, atmosfera, wnętrze)
   - INFO (Informacja, godziny otwarcia, zmiany)

2. event_date - data wydarzenia (format YYYY-MM-DD), tylko jeśli to wydarzenie (EV_*)

3. event_identifier - unikalny identyfikator wydarzenia (np. "walentynki-2026", "koncert-kowalski-2026"), tylko dla EV_*

4. promotion_end_date - sugerowana data końca promocji (format YYYY-MM-DD):
   - Dla wydarzeń: data wydarzenia
   - Dla promocji jednorazowych: data zakończenia lub max 14 dni
   - Dla promocji cyklicznych: max 60 dni
   - Dla produktów/brand/info: max 30 dni

Odpowiedz TYLKO jako JSON, bez dodatkowego tekstu.`;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.getOrThrow('OPENROUTER_API_KEY');
  }

  async categorizePost(content: string): Promise<CategorizeResult> {
    const today = new Date().toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    const userPrompt = `Data dzisiejsza: ${today}
Maksymalna data końca promocji: ${maxDateStr}

Post do analizy:
${content}

Odpowiedz jako JSON z polami: category, event_date, event_identifier, promotion_end_date`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message: string };
      };

      if (data.error) {
        throw new Error(data.error.message);
      }

      const responseText = data.choices?.[0]?.message?.content || '';
      this.logger.debug(`LLM Response: ${responseText}`);

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]) as CategorizeResult;

      // Validate category
      if (!VALID_CATEGORIES.includes(result.category)) {
        this.logger.warn(`Invalid category: ${result.category}, defaulting to INFO`);
        result.category = 'INFO';
      }

      // Ensure promotion_end_date doesn't exceed event_date for events
      if (result.event_date && result.promotion_end_date > result.event_date) {
        result.promotion_end_date = result.event_date;
      }

      // Ensure promotion_end_date doesn't exceed max 60 days
      if (result.promotion_end_date > maxDateStr) {
        result.promotion_end_date = maxDateStr;
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to categorize post: ${error}`);
      // Return safe defaults
      const defaultEndDate = new Date();
      defaultEndDate.setDate(defaultEndDate.getDate() + 30);
      
      return {
        category: 'INFO',
        event_date: null,
        event_identifier: null,
        promotion_end_date: defaultEndDate.toISOString().split('T')[0],
      };
    }
  }
}
