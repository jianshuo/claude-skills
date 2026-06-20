# release_lane.rb — the App Store submit-for-review lane.
#
# Paste these into your existing fastlane/Fastfile (the one that already has the
# `beta`/TestFlight lane from wjs-publishing-testflight), INSIDE `platform :ios`.
# Replace BUNDLE_ID / SCHEME / PROJECT if your Fastfile doesn't already set them.
#
# Mental model:
#   git push           → beta lane  → TestFlight (unchanged, automatic)
#   fastlane release   → THIS lane  → upload metadata + screenshots, submit for review
#
# Prereqs already provided by the TestFlight setup: match appstore certs, the
# ASC_API_* env vars / secrets, and an App Store Connect app record (created on
# your first TestFlight upload, or via `fastlane produce`).

  # Refuse to submit while a version is already waiting on Apple — a second
  # submit would either fail or clobber the in-flight one.
  def guard_not_in_review
    require "spaceship"
    app = Spaceship::ConnectAPI::App.find(BUNDLE_ID)
    UI.user_error!("App #{BUNDLE_ID} not found on App Store Connect — create the record first (fastlane produce or one TestFlight upload).") unless app
    app.get_app_store_versions(filter: { platform: "IOS" }).each do |v|
      if %w[WAITING_FOR_REVIEW IN_REVIEW PENDING_DEVELOPER_RELEASE].include?(v.app_version_state)
        UI.user_error!("Version #{v.version_string} is #{v.app_version_state} — wait for it to finish before submitting again.")
      end
    end
  end

  desc "App Store: upload metadata + screenshots, then submit the current build for review."
  lane :release do
    setup_ci

    api_key = app_store_connect_api_key(
      key_id:                ENV["ASC_API_KEY_ID"],
      issuer_id:             ENV["ASC_API_ISSUER_ID"],
      key_content:           ENV["ASC_API_KEY_CONTENT"],
      is_key_content_base64: true,
      duration:              1200,
      in_house:              false
    )

    app_version = get_version_number(xcodeproj: PROJECT, target: SCHEME)
    guard_not_in_review

    # `fastlane release skip_build:true` reuses the build the beta lane already
    # pushed to TestFlight (same MARKETING_VERSION). Default = build fresh.
    unless options[:skip_build]
      build_num = latest_testflight_build_number(
        api_key: api_key, app_identifier: BUNDLE_ID, initial_build_number: 0
      ) + 1
      match(
        type:                    "appstore",
        readonly:                true,
        git_basic_authorization: ENV["MATCH_GIT_BASIC_AUTH"] && Base64.strict_encode64(ENV["MATCH_GIT_BASIC_AUTH"]),
        api_key:                 api_key
      )
      increment_build_number(xcodeproj: PROJECT, build_number: build_num)
      build_app(
        project:       PROJECT,
        scheme:        SCHEME,
        export_method: "app-store",
        xcargs: "CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER='match AppStore #{BUNDLE_ID}'",
        export_options: { provisioningProfiles: { BUNDLE_ID => "match AppStore #{BUNDLE_ID}" } }
      )
    end

    # Push the listing (text + screenshots) and submit. This is the difference
    # from the TestFlight lane, which sets skip_metadata/skip_screenshots: true.
    upload_to_app_store(
      api_key:                    api_key,
      app_version:                app_version,
      skip_binary_upload:         options[:skip_build] ? true : false, # skip_build → reuse TestFlight build; else upload the ipa just built
      skip_metadata:              false,
      skip_screenshots:           false,
      overwrite_screenshots:      true,
      submit_for_review:          true,
      automatic_release:          true,
      reject_if_possible:         true,
      precheck_include_in_app_purchases: false,
      run_precheck_before_submit: true,
      force:                      true,  # don't open the HTML preview / prompt
      submission_information: {
        add_id_info_uses_idfa:             false,
        export_compliance_uses_encryption: false
      }
    )

    sh("git tag release/#{app_version} || true")
    UI.success("Submitted #{app_version} for App Store review.")
  end
