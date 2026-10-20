import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://okodqgmlvzxlhqmzqngn.supabase.co";
const supabasePublishableKey = "sb_publishable_9Stb6lvlDweFW-c1rT7sfQ_OuDPRS0W";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
