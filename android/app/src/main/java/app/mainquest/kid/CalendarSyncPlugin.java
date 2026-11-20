package app.mainquest.kid;

import android.Manifest;
import android.accounts.Account;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Attendees;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Events;
import android.provider.CalendarContract.Instances;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

/**
 * MainQuest ↔ Android calendar provider.
 * Android's Google Calendar sync adapter keeps these calendars in two-way sync with Google,
 * so reading/writing here = reading/writing the Google Calendar (and guests get Google invites).
 */
@CapacitorPlugin(
    name = "CalendarSync",
    permissions = {
        @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR })
    }
)
public class CalendarSyncPlugin extends Plugin {

    private ContentResolver cr() { return getContext().getContentResolver(); }

    private boolean guard(PluginCall call) {
        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            call.reject("Calendar permission not granted", "NO_PERMISSION");
            return false;
        }
        return true;
    }

    private static String statusName(int s) {
        switch (s) {
            case Attendees.ATTENDEE_STATUS_ACCEPTED: return "accepted";
            case Attendees.ATTENDEE_STATUS_DECLINED: return "declined";
            case Attendees.ATTENDEE_STATUS_INVITED: return "invited";
            case Attendees.ATTENDEE_STATUS_TENTATIVE: return "tentative";
            default: return "none";
        }
    }

    private static int statusCode(String s) {
        if ("accepted".equals(s)) return Attendees.ATTENDEE_STATUS_ACCEPTED;
        if ("declined".equals(s)) return Attendees.ATTENDEE_STATUS_DECLINED;
        if ("tentative".equals(s)) return Attendees.ATTENDEE_STATUS_TENTATIVE;
        return Attendees.ATTENDEE_STATUS_INVITED;
    }

    private static List<String> strings(JSArray arr) {
        List<String> out = new ArrayList<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            Object o = arr.opt(i);
            if (o != null) out.add(String.valueOf(o));
        }
        return out;
    }

    private static String placeholders(int n) { return TextUtils.join(",", Collections.nCopies(n, "?")); }

    private static long num(PluginCall call, String key, long def) {
        Object o = call.getData().opt(key);
        if (o instanceof Number) return ((Number) o).longValue();
        if (o instanceof String) { try { return Long.parseLong((String) o); } catch (Exception ignored) { } }
        return def;
    }

    /* ------------------------------------------------------------------ calendars */
    @PluginMethod
    public void listCalendars(PluginCall call) {
        if (!guard(call)) return;
        String[] proj = {
            Calendars._ID, Calendars.CALENDAR_DISPLAY_NAME, Calendars.ACCOUNT_NAME, Calendars.ACCOUNT_TYPE,
            Calendars.OWNER_ACCOUNT, Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CALENDAR_COLOR, Calendars.VISIBLE, Calendars.IS_PRIMARY
        };
        JSArray out = new JSArray();
        try (Cursor c = cr().query(Calendars.CONTENT_URI, proj, null, null, null)) {
            while (c != null && c.moveToNext()) {
                JSObject o = new JSObject();
                o.put("id", String.valueOf(c.getLong(0)));
                o.put("name", c.getString(1));
                o.put("account", c.getString(2));
                o.put("accountType", c.getString(3));
                o.put("owner", c.getString(4));
                o.put("access", c.getInt(5));
                o.put("writable", c.getInt(5) >= Calendars.CAL_ACCESS_CONTRIBUTOR);
                o.put("color", String.format(Locale.US, "#%06X", 0xFFFFFF & c.getInt(6)));
                o.put("visible", c.getInt(7) == 1);
                o.put("primary", !c.isNull(8) && c.getInt(8) == 1);
                out.put(o);
            }
        } catch (Exception e) {
            call.reject("listCalendars failed: " + e.getMessage());
            return;
        }
        JSObject r = new JSObject();
        r.put("calendars", out);
        call.resolve(r);
    }

    /* ------------------------------------------------------------------ events (recurring events expanded) */
    @PluginMethod
    public void listEvents(PluginCall call) {
        if (!guard(call)) return;
        long start = num(call, "start", System.currentTimeMillis());
        long end = num(call, "end", start + 30L * 86400000L);
        List<String> ids = strings(call.getArray("calendarIds"));

        Uri.Builder b = Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, start);
        ContentUris.appendId(b, end);
        String[] proj = {
            Instances.EVENT_ID, Instances.BEGIN, Instances.END, Instances.TITLE, Instances.EVENT_LOCATION, Instances.DESCRIPTION,
            Instances.ALL_DAY, Instances.CALENDAR_ID, Instances.ORGANIZER, Instances.SELF_ATTENDEE_STATUS, Instances.HAS_ATTENDEE_DATA,
            Instances.STATUS, Instances.RRULE
        };
        String sel = null;
        String[] args = null;
        if (!ids.isEmpty()) {
            sel = Instances.CALENDAR_ID + " IN (" + placeholders(ids.size()) + ")";
            args = ids.toArray(new String[0]);
        }
        List<JSObject> events = new ArrayList<>();
        Map<Long, List<JSObject>> byEvent = new HashMap<>();
        try (Cursor c = cr().query(b.build(), proj, sel, args, Instances.BEGIN + " ASC")) {
            while (c != null && c.moveToNext()) {
                if (!c.isNull(11) && c.getInt(11) == Events.STATUS_CANCELED) continue;
                long eid = c.getLong(0);
                JSObject o = new JSObject();
                o.put("eventId", String.valueOf(eid));
                o.put("begin", c.getLong(1));
                o.put("end", c.getLong(2));
                o.put("title", c.getString(3));
                o.put("location", c.getString(4));
                o.put("description", c.getString(5));
                o.put("allDay", c.getInt(6) == 1);
                o.put("calendarId", String.valueOf(c.getLong(7)));
                o.put("organizer", c.getString(8));
                o.put("selfStatus", statusName(c.isNull(9) ? 0 : c.getInt(9)));
                o.put("hasAttendees", !c.isNull(10) && c.getInt(10) == 1);
                o.put("recurring", !c.isNull(12) && c.getString(12).length() > 0);
                o.put("attendees", new JSArray());
                events.add(o);
                if (!byEvent.containsKey(eid)) byEvent.put(eid, new ArrayList<>());
                byEvent.get(eid).add(o);
            }
        } catch (Exception e) {
            call.reject("listEvents failed: " + e.getMessage());
            return;
        }

        // Attendees, in chunks
        List<Long> eids = new ArrayList<>(byEvent.keySet());
        String[] aproj = { Attendees.EVENT_ID, Attendees.ATTENDEE_NAME, Attendees.ATTENDEE_EMAIL, Attendees.ATTENDEE_STATUS, Attendees.ATTENDEE_RELATIONSHIP };
        for (int i = 0; i < eids.size(); i += 200) {
            List<Long> chunk = eids.subList(i, Math.min(eids.size(), i + 200));
            String[] aargs = new String[chunk.size()];
            for (int k = 0; k < chunk.size(); k++) aargs[k] = String.valueOf(chunk.get(k));
            try (Cursor c = cr().query(Attendees.CONTENT_URI, aproj, Attendees.EVENT_ID + " IN (" + placeholders(chunk.size()) + ")", aargs, null)) {
                while (c != null && c.moveToNext()) {
                    JSObject a = new JSObject();
                    a.put("name", c.getString(1));
                    a.put("email", c.getString(2));
                    a.put("status", statusName(c.isNull(3) ? 0 : c.getInt(3)));
                    a.put("organizer", !c.isNull(4) && c.getInt(4) == Attendees.RELATIONSHIP_ORGANIZER);
                    List<JSObject> owners = byEvent.get(c.getLong(0));
                    if (owners == null) continue;
                    for (JSObject o : owners) {
                        try { ((JSONArray) o.get("attendees")).put(a); } catch (Exception ignored) { }
                    }
                }
            } catch (Exception ignored) { }
        }
        JSArray out = new JSArray();
        for (JSObject o : events) out.put(o);
        JSObject r = new JSObject();
        r.put("events", out);
        call.resolve(r);
    }

    private ContentValues eventValues(PluginCall call) {
        ContentValues v = new ContentValues();
        if (call.getData().has("title")) v.put(Events.TITLE, call.getString("title", ""));
        if (call.getData().has("description")) v.put(Events.DESCRIPTION, call.getString("description", ""));
        if (call.getData().has("location")) v.put(Events.EVENT_LOCATION, call.getString("location", ""));
        if (call.getData().has("start")) {
            boolean allDay = Boolean.TRUE.equals(call.getBoolean("allDay", false));
            long start = num(call, "start", System.currentTimeMillis());
            long end = num(call, "end", start + (allDay ? 86400000L : 3600000L));
            v.put(Events.DTSTART, start);
            v.put(Events.DTEND, end);
            v.put(Events.ALL_DAY, allDay ? 1 : 0);
            v.put(Events.EVENT_TIMEZONE, allDay ? "UTC" : TimeZone.getDefault().getID());
        }
        return v;
    }

    private Set<String> existingAttendees(long eventId) {
        Set<String> out = new HashSet<>();
        try (Cursor c = cr().query(Attendees.CONTENT_URI, new String[] { Attendees.ATTENDEE_EMAIL },
                Attendees.EVENT_ID + "=?", new String[] { String.valueOf(eventId) }, null)) {
            while (c != null && c.moveToNext()) if (c.getString(0) != null) out.add(c.getString(0).toLowerCase(Locale.US));
        }
        return out;
    }

    /** Make the guest list match `emails` (organizer row is never touched). */
    private void syncAttendees(long eventId, List<String> emails, String selfEmail) {
        Set<String> want = new HashSet<>();
        for (String e : emails) if (e != null && e.contains("@")) want.add(e.trim().toLowerCase(Locale.US));
        if (selfEmail != null) want.remove(selfEmail.toLowerCase(Locale.US));
        Set<String> have = existingAttendees(eventId);
        if (selfEmail != null) have.remove(selfEmail.toLowerCase(Locale.US));
        for (String e : have) {
            if (!want.contains(e)) {
                cr().delete(Attendees.CONTENT_URI, Attendees.EVENT_ID + "=? AND LOWER(" + Attendees.ATTENDEE_EMAIL + ")=? AND "
                    + Attendees.ATTENDEE_RELATIONSHIP + "!=?", new String[] { String.valueOf(eventId), e, String.valueOf(Attendees.RELATIONSHIP_ORGANIZER) });
            }
        }
        for (String e : want) {
            if (have.contains(e)) continue;
            ContentValues a = new ContentValues();
            a.put(Attendees.EVENT_ID, eventId);
            a.put(Attendees.ATTENDEE_EMAIL, e);
            a.put(Attendees.ATTENDEE_RELATIONSHIP, Attendees.RELATIONSHIP_ATTENDEE);
            a.put(Attendees.ATTENDEE_TYPE, Attendees.TYPE_REQUIRED);
            a.put(Attendees.ATTENDEE_STATUS, Attendees.ATTENDEE_STATUS_INVITED);
            cr().insert(Attendees.CONTENT_URI, a);
        }
        if (!want.isEmpty()) {
            ContentValues v = new ContentValues();
            v.put(Events.HAS_ATTENDEE_DATA, 1);
            cr().update(ContentUris.withAppendedId(Events.CONTENT_URI, eventId), v, null, null);
        }
    }

    @PluginMethod
    public void createEvent(PluginCall call) {
        if (!guard(call)) return;
        String calId = call.getString("calendarId");
        if (calId == null) { call.reject("calendarId is required"); return; }
        try {
            ContentValues v = eventValues(call);
            v.put(Events.CALENDAR_ID, Long.parseLong(calId));
            String self = call.getString("selfEmail");
            List<String> guests = strings(call.getArray("attendees"));
            if (!guests.isEmpty() && self != null) { v.put(Events.ORGANIZER, self); v.put(Events.HAS_ATTENDEE_DATA, 1); }
            Uri uri = cr().insert(Events.CONTENT_URI, v);
            if (uri == null) { call.reject("insert returned null"); return; }
            long id = ContentUris.parseId(uri);
            if (!guests.isEmpty()) syncAttendees(id, guests, self);
            JSObject r = new JSObject();
            r.put("id", String.valueOf(id));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("createEvent failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updateEvent(PluginCall call) {
        if (!guard(call)) return;
        try {
            long id = Long.parseLong(call.getString("id", "0"));
            ContentValues v = eventValues(call);
            int n = v.size() > 0 ? cr().update(ContentUris.withAppendedId(Events.CONTENT_URI, id), v, null, null) : 1;
            if (n == 0) { call.reject("Event not found", "NOT_FOUND"); return; }
            if (call.getData().has("attendees")) syncAttendees(id, strings(call.getArray("attendees")), call.getString("selfEmail"));
            call.resolve();
        } catch (Exception e) {
            call.reject("updateEvent failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void deleteEvent(PluginCall call) {
        if (!guard(call)) return;
        try {
            long id = Long.parseLong(call.getString("id", "0"));
            cr().delete(ContentUris.withAppendedId(Events.CONTENT_URI, id), null, null);
            call.resolve();
        } catch (Exception e) {
            call.reject("deleteEvent failed: " + e.getMessage());
        }
    }

    /** Accept / maybe / decline an invite. Google sends the reply to the organizer on sync. */
    @PluginMethod
    public void setRsvp(PluginCall call) {
        if (!guard(call)) return;
        try {
            String eventId = call.getString("eventId", "0");
            String email = call.getString("email", "");
            ContentValues v = new ContentValues();
            v.put(Attendees.ATTENDEE_STATUS, statusCode(call.getString("status", "accepted")));
            int n = cr().update(Attendees.CONTENT_URI, v, Attendees.EVENT_ID + "=? AND LOWER(" + Attendees.ATTENDEE_EMAIL + ")=?",
                new String[] { eventId, email.toLowerCase(Locale.US) });
            if (n == 0) { call.reject("You're not on the guest list for this event", "NOT_ATTENDEE"); return; }
            call.resolve();
        } catch (Exception e) {
            call.reject("setRsvp failed: " + e.getMessage());
        }
    }

    /** Ask Android to sync these calendars' accounts now (pushes changes + pulls new invites). */
    @PluginMethod
    public void requestSync(PluginCall call) {
        if (!guard(call)) return;
        List<String> ids = strings(call.getArray("calendarIds"));
        int n = 0;
        if (!ids.isEmpty()) {
            Set<String> done = new HashSet<>();
            try (Cursor c = cr().query(Calendars.CONTENT_URI, new String[] { Calendars.ACCOUNT_NAME, Calendars.ACCOUNT_TYPE },
                    Calendars._ID + " IN (" + placeholders(ids.size()) + ")", ids.toArray(new String[0]), null)) {
                while (c != null && c.moveToNext()) {
                    String name = c.getString(0), type = c.getString(1);
                    if (name == null || type == null || CalendarContract.ACCOUNT_TYPE_LOCAL.equals(type) || !done.add(name + "|" + type)) continue;
                    Bundle extras = new Bundle();
                    extras.putBoolean(ContentResolver.SYNC_EXTRAS_MANUAL, true);
                    extras.putBoolean(ContentResolver.SYNC_EXTRAS_EXPEDITED, true);
                    ContentResolver.requestSync(new Account(name, type), CalendarContract.AUTHORITY, extras);
                    n++;
                }
            } catch (Exception ignored) { }
        }
        JSObject r = new JSObject();
        r.put("accounts", n);
        call.resolve(r);
    }

    /** Creates a phone-only test calendar with one sample invite, so the flow can be tried without a Google account. */
    @PluginMethod
    public void createTestCalendar(PluginCall call) {
        if (!guard(call)) return;
        final String acct = "MainQuest Test";
        final String self = "player@mainquest.test";
        try {
            Uri calUri = Calendars.CONTENT_URI.buildUpon()
                .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                .appendQueryParameter(Calendars.ACCOUNT_NAME, acct)
                .appendQueryParameter(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL).build();
            long calId = -1;
            try (Cursor c = cr().query(Calendars.CONTENT_URI, new String[] { Calendars._ID }, Calendars.ACCOUNT_NAME + "=? AND " + Calendars.ACCOUNT_TYPE + "=?",
                    new String[] { acct, CalendarContract.ACCOUNT_TYPE_LOCAL }, null)) {
                if (c != null && c.moveToFirst()) calId = c.getLong(0);
            }
            if (calId < 0) {
                ContentValues v = new ContentValues();
                v.put(Calendars.ACCOUNT_NAME, acct);
                v.put(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
                v.put(Calendars.NAME, acct);
                v.put(Calendars.CALENDAR_DISPLAY_NAME, "MainQuest test calendar");
                v.put(Calendars.CALENDAR_COLOR, 0xFF3DE2FF);
                v.put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_OWNER);
                v.put(Calendars.OWNER_ACCOUNT, self);
                v.put(Calendars.VISIBLE, 1);
                v.put(Calendars.SYNC_EVENTS, 1);
                Uri u = cr().insert(calUri, v);
                if (u == null) { call.reject("Could not create test calendar"); return; }
                calId = ContentUris.parseId(u);
            }
            // sample invite tomorrow 5:30pm, organized by someone else
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.add(java.util.Calendar.DAY_OF_YEAR, 1);
            cal.set(java.util.Calendar.HOUR_OF_DAY, 17); cal.set(java.util.Calendar.MINUTE, 30); cal.set(java.util.Calendar.SECOND, 0); cal.set(java.util.Calendar.MILLISECOND, 0);
            ContentValues ev = new ContentValues();
            ev.put(Events.CALENDAR_ID, calId);
            ev.put(Events.TITLE, "Team practice (test invite)");
            ev.put(Events.EVENT_LOCATION, "Field 3");
            ev.put(Events.DTSTART, cal.getTimeInMillis());
            ev.put(Events.DTEND, cal.getTimeInMillis() + 90L * 60000L);
            ev.put(Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
            ev.put(Events.ORGANIZER, "coach@mainquest.test");
            ev.put(Events.HAS_ATTENDEE_DATA, 1);
            Uri eu = cr().insert(Events.CONTENT_URI, ev);
            long eid = ContentUris.parseId(eu);
            ContentValues org = new ContentValues();
            org.put(Attendees.EVENT_ID, eid); org.put(Attendees.ATTENDEE_EMAIL, "coach@mainquest.test"); org.put(Attendees.ATTENDEE_NAME, "Coach");
            org.put(Attendees.ATTENDEE_RELATIONSHIP, Attendees.RELATIONSHIP_ORGANIZER); org.put(Attendees.ATTENDEE_STATUS, Attendees.ATTENDEE_STATUS_ACCEPTED);
            cr().insert(Attendees.CONTENT_URI, org);
            ContentValues me = new ContentValues();
            me.put(Attendees.EVENT_ID, eid); me.put(Attendees.ATTENDEE_EMAIL, self);
            me.put(Attendees.ATTENDEE_RELATIONSHIP, Attendees.RELATIONSHIP_ATTENDEE); me.put(Attendees.ATTENDEE_TYPE, Attendees.TYPE_REQUIRED);
            me.put(Attendees.ATTENDEE_STATUS, Attendees.ATTENDEE_STATUS_INVITED);
            cr().insert(Attendees.CONTENT_URI, me);
            JSObject r = new JSObject();
            r.put("calendarId", String.valueOf(calId));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("createTestCalendar failed: " + e.getMessage());
        }
    }
}
