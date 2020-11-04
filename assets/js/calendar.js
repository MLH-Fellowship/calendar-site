const CALENDAR_ID = 'majorleaguehacking.com_pr3njjh4ok0pi93jfqm51jg2g0@group.calendar.google.com'
const CALENDAR_KEY = 'AIzaSyCvFbAkqIoeJfGqoA_LssluJriHCX3PBmk'

const DATE_24HR_FORMAT = {
    hour: '2-digit',
    minute: '2-digit',
    omitZeroMinute: false,
    hour12: false
}

const DATE_RANGE_FORMAT = {
    month: 'short',
    day: 'numeric',
    separator: ' to ',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
}

let calendar
let calendarElement

document.addEventListener('DOMContentLoaded', () => {
    calendarElement = document.querySelector('#calendar')
    
    const now = Date.now();

    calendar = new FullCalendar.Calendar(calendarElement, {
        plugins: ['dayGrid', 'googleCalendar', 'list', 'timeGrid'],
        defaultView: 'listYear',
        header: { center: '' },
        titleFormat: { year: 'numeric', day: 'numeric' },
        buttonText: { list: 'All', today: 'Today' },
        firstDay: 1,
        height: 1000,
        themeSystem: 'bootstrap',
        googleCalendarApiKey: CALENDAR_KEY,
        eventClick: displayEvent,
        events: {
            googleCalendarId: CALENDAR_ID,
            failure: onLoadFailed
        },
        eventTimeFormat: DATE_24HR_FORMAT,
        views: {
            // all upcoming events view
            listYear: {
                listDayFormat: { year: 'numeric', month: 'short', day: '2-digit', omitCommas: true },
                listDayAltFormat: { weekday: 'long' }
            }
        },
        eventRender: ({ event }) => event.end.getTime() > now,
    })
    document.getElementById('timezone').innerHTML = `All times are in your local timezone! (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
    calendar.render()
})

/*
    Parses using `:` as a delemeter. Anything between `\n` and a `:`
    is considered a key and everything until the next new line containing
    a `:` is the value.

    NOTE: The parser ignored colons followed by `//` assuming they are links.
*/
const parseKeyVal = desc => {
    const lines = desc.split('\n')
    // using an array to retain the order we parsed it in
    const sections = []
    let foundFirstSection = false
    for (const line of lines) {
        const colon = line.indexOf(':')
        const isLink = line.slice(colon + 1, colon + 3) === '//'
        if (foundFirstSection && (colon === -1 || isLink)) {
        sections[sections.length - 1][1] += line + '\n'
        } else if (!isLink) {
        foundFirstSection = true
        sections.push([line.slice(0, colon), line.slice(colon + 1) + '\n'])
        }
    }
    return sections
}

/*
    Inclusively removes the text contained within parentheses.
*/
const removeParentheses = str => {
  let output = '', i = -1, depth = 0;
  while (++i < str.length) {
    depth += str[i] === '('
    if (!depth) output += str[i];
    depth -= str[i] === ')'
  }
  return output
}

/*
    Remove a list of keys from a copy of the input object.
*/
const drop = (o, keys) => {
  const r = {...o}
  keys.forEach(k => {
    delete r[k]
  })
  return r
}

/*
    Usess the `order` param to rejoin the data in a clean way similar to the
    originally parsed data. `keyOverwites` is an object that defines
    which keys should be renamed and what they should be renamed to.
*/
const rejoinKeyValuesInOrder = (order, data, keyOverwites) => 
    order.reduce((collection, key) => {
        const item = data[key];
        if (item !== undefined) {
            // if no key override has been set, default to the raw key
            let header = keyOverwites[key] || item.rawKey
            // if the key is not an empty string
            if (header.length > 0) {
                header = `<strong>${header}</strong>: `
                // retain leading newlines in whitespace
                const leadindingWhitespace = item.rawVal.match(/^\s+/)
                if (leadindingWhitespace[0].includes('\n')) {
                    header += '\n'
                }
            }
            return [...collection, header + item.rawVal.trim()]
        }
        return collection
    }, [])
        // make all the spaceing equidistant 
        .join('\n\n')
  

const slugify = str => str
        .replace(/[^\w]+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\s/g, '_')

/*
    Takes a couple of inputs and runs the data though all the above functions to normalize the data,
    pick out and remove certian sections/keys, and then rejoin the data, evenly space the new lines,
    bolden the leading text before the colons on each line, etc.
*/
const extractDataAndReformatDesciption = (description, { normalizationMap, dropMap, orderOverride, renameKeys }) => {
    const store = parseKeyVal(description)
    const normalized = store.map(([key, val]) => {
        return [slugify(removeParentheses(key)), {
                raw: key + ':' + val,
                rawKey: key,
                rawVal: val,
                val: val.trim()
            }
        ]
    })
    // remove all the keys we'll never need and never want to show
    const data = drop(normalized.reduce((collection, item) => ({ ...collection, [item[0]]: item[1] }), {}), dropMap)
    
    // collect the keys we translated so we can remove them before
    // stitching everything back together
    const consumedKeys = [];

    // collect the translated keys
    const translatedKeys = {}
    Object.keys(normalizationMap).forEach(parent => {
        for (const child of normalizationMap[parent]) {
            if (data[child] !== undefined) {
                translatedKeys[parent] = ret[child].val
                consumedKeys.push(child)
                break
            }
        }
    });

    // copy the default order
    const order = [...orderOverride]

    // don't copy items if they already exist in
    // the overridden order
    normalized.forEach(([key]) => {
        if (!order.includes(key)) order.push(key)
    })
    
    return {
        raw: rejoinKeyValuesInOrder(order, drop(data, consumedKeys), renameKeys),
        ...translatedKeys
    }
}

const RE_URL = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i);

const reformatOptions = {
    normalizationMap: {
        linkedin: ['your_linkedin_url'],
        github: ['your_github_url'],
        twitter: ['your_twitter_url']
    },
    dropMap: ['event_name', 'what_is_the_title_of_this_session', 'cancellation_policy', 'cancel', 'reschedule', 'thumbnail', 'join_this_call_15_minutes_beforehand', 'join_this_skype_call_15_minutes_before'],
    orderOverride: ['speaker', 'short_speaker_bio', 'please_give_a_brief_description_of_this_session_this_will_be_shared_with_the_fellows'],
    renameKeys: {
        please_give_a_brief_description_of_this_session_this_will_be_shared_with_the_fellows: 'Description',
        short_speaker_bio: 'Bio',
        what_topics_will_you_be_covering: 'Topics',
        what_type_of_session_is_this: 'Type',
        can_we_record_this_session: 'Will the session be recorded'
    }   
}

function displayEvent(info) {
    info.jsEvent.preventDefault()

    const date = info.event._instance.range;
    $('#event-title').text(info.event._def.title);
    $('#event-date').text(FullCalendar.formatRange(date.start, date.end, DATE_RANGE_FORMAT));

    const description = extractDataAndReformatDesciption(
        (info.event._def.extendedProps.description || '')
            .replace(/<br>/g, '\n')
            .replace(/\n[—–-]{2,}\n*/g, ''),
        reformatOptions
    );

    // fill out social links
    ['linkedin', 'github', 'twitter'].forEach(key => {
        const el = $(`#social-${key}`).hide();
        if (description[key]) {
            const match = description[key].match(RE_URL)
            if (match) {
                el.attr('href', match[0]).show()
            }
        }
    })

    $('#event-desc').html(filterXSS(description.raw.replace(/\n/g, '<br>')));
    $('#event-link').attr("href", info.event._def.extendedProps.location);
    $('#event-modal').modal('show')
}

function onLoadFailed(error) {
    calendarElement.innerHTML =
        `<div id="calendar-error">
      <h3>Could not load calendar</h3>
      <p>HTTP Error ${error.xhr.status}</p>
    </div>`
}