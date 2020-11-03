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

const removeParentheses = s => {
  let r = '', i = -1, d=0;
  while (++i < s.length) {
    d += s[i] === '('
    if (!d) r += s[i];
    d -= s[i] === ')'
  }
  return r
}

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
function displayEvent(info) {
    info.jsEvent.preventDefault()

    const date = info.event._instance.range;
    $('#event-title').text(info.event._def.title);
    $('#event-date').text(FullCalendar.formatRange(date.start, date.end, DATE_RANGE_FORMAT));
    let description = info.event._def.extendedProps.description;
	let calendlyRegexCancel = new RegExp('(https:\/\/calendly.com\/cancellations\/)+');
	let calendlyRegexReschedule = new RegExp('(https:\/\/calendly.com\/reschedulings\/)+');
    
    if (typeof description !== 'undefined') {
        console.log("")
        while (calendlyRegexCancel.test(description) || calendlyRegexReschedule.test(description))
        {
            description = description.replace(calendlyRegexCancel, '');
            description = description.replace(calendlyRegexReschedule, '');
        }
    
        let regex = new RegExp('(?<=href=").*?(?=")');
        let regexHtml = new RegExp('<\s*a[^>]*>(.*?)<\s*/\s*a>');
        while (regex.test(description))
        {
            let url = description.match(regex);
            description = description.replace(regexHtml, url.toString().substring(8, url.toString().length));
        }
    } else {
        description = "";
    }
    $('#event-desc').html(filterXSS(description));
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