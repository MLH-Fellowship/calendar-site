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
  const store = []
  let foundHead = false
  for (const line of lines) {
    const colon = line.indexOf(':')
    const isLink = line.slice(colon + 1, colon + 3) === '//'
    if (foundHead && (colon === -1 || isLink)) {
      store[store.length - 1][1] += line + '\n'
    } else if (!isLink) {
      foundHead = true
      store.push([line.slice(0, colon), line.slice(colon + 1) + '\n'])
    }
  }
  return store
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

const rejoinInOrder = (store, data) => 
  store.reduce((collection, [key]) => collection + ((data[key] || {}).raw || ''), '')

const extractDataAndReformatDesciption = (description, normalizationMap, dropMap) => {
  const store = parseKeyVal(description)
  const normalized = store.map(([key, val]) => {
    return [removeParentheses(key)
      .replace(/[^\w]+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '_'), {
        raw: key + ':' + val,
        val: val.trim()
      }
    ]
  })
  console.log(normalized);
  const data = drop(normalized.reduce((collection, item) => ({ ...collection, [item[0]]: item[1] }), {}), dropMap)
  const ret = {}
  const usedKeys = []
  Object.keys(normalizationMap).forEach(key => {
    for (const subKey of normalizationMap[key]) {
      if ((ret[key] = data[subKey]) !== undefined) {
        ret[key] = ret[key].val;
        usedKeys.push(subKey)
        break;
      }
    }
  })
  return {
    ...ret,
    raw: rejoinInOrder(normalized, drop(data, usedKeys))
  }
}

const RE_URL = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i);

function displayEvent(info) {
    info.jsEvent.preventDefault()

    const date = info.event._instance.range;
    $('#event-title').text(info.event._def.title);
    $('#event-date').text(FullCalendar.formatRange(date.start, date.end, DATE_RANGE_FORMAT));
    const description = info.event._def.extendedProps.description;

    const normalizationMap = {
        linkedin: ['your_linkedin_url'],
        github: ['your_github_url'],
        twitter: ['your_twitter_url']
    }

    const desc = extractDataAndReformatDesciption(description.replace(/<br>/g, '\n'), normalizationMap, ['event_name', 'what_is_the_title_of_this_session', 'cancellation_policy', 'cancel', 'reschedule']);

    ['linkedin', 'github', 'twitter'].forEach(key => {
        const el = $(`#social-${key}`).hide();
        const v = desc[key]
        if (v) {
            const matches = v.match(RE_URL)
            if (matches[0]) {
                el.attr('href', matches[0])
                el.show()
            }
        }
    })

    $('#event-desc').html(filterXSS(desc.raw).replace(/\n/g, '<br>'));
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