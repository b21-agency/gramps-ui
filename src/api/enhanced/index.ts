// Registers the cache rules (tags, result transforms) of every enhanced slice on the shared
// api before anything runs, so no generated endpoint is ever used without them. Call sites
// import hooks from the individual files.
import './people-slice-enhanced'
import './families-slice-enhanced'
import './events-slice-enhanced'
import './places-slice-enhanced'
import './sources-slice-enhanced'
import './citations-slice-enhanced'
import './repositories-slice-enhanced'
import './notes-slice-enhanced'
import './media-slice-enhanced'
import './tags-slice-enhanced'
import './search-slice-enhanced'
import './metadata-slice-enhanced'
import './transactions-slice-enhanced'
import './users-slice-enhanced'
import './trees-slice-enhanced'
import './tasks-slice-enhanced'
