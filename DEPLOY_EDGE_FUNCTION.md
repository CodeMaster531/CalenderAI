# Deploy Edge Function - Quick Guide

## Option 1: Using Supabase CLI (Recommended)

### Install Supabase CLI (if not installed)
```bash
npm install -g supabase
# OR
brew install supabase/tap/supabase  # macOS
```

### Login to Supabase
```bash
supabase login
```

### Link to your project
```bash
# Get your project ref from Supabase Dashboard → Settings → General
# It's in the URL: https://vvminzmrytzujvwritfv.supabase.co
# Project ref is: vvminzmrytzujvwritfv

supabase link --project-ref vvminzmrytzujvwritfv
```

### Deploy the function
```bash
supabase functions deploy process-document
```

---

## Option 2: Manual Deployment via Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"**
3. Name: `process-document`
4. Copy the contents of `supabase/functions/process-document/index.ts`
5. Paste into the editor
6. Click **"Deploy"**

---

## Verify Deployment

After deployment, test with:
```bash
curl -X POST https://vvminzmrytzujvwritfv.supabase.co/functions/v1/process-document \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"documentId":"test"}'
```

You should get a response (even if it's an error about document not found - that means the function is working).

---

## Troubleshooting

- **CORS errors**: Make sure the function is deployed and responding
- **Function not found**: Deploy it first using one of the methods above
- **Environment variables**: The function uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` which are automatically provided by Supabase

